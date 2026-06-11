from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max, Prefetch
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.models import ProviderStaff
from booking.serializers import ProviderStaffSerializer
from notifications.models import InAppNotification

from .models import Conversation, ConversationMember, Message
from .serializers import ConversationSerializer, MessageSerializer
from .services import get_or_create_client_conversation, staff_can_access_client_chats

User = get_user_model()


def _ensure_saved_messages_chat(user):
    if not user.is_authenticated:
        return
    exists = Conversation.objects.filter(
        members__user=user, is_saved_messages=True
    ).exists()
    if exists:
        return
    conv = Conversation.objects.create(
        title="",
        is_group=False,
        is_saved_messages=True,
        is_client_correspondence=False,
        organization=user if user.role == "provider" else None,
    )
    ConversationMember.objects.create(conversation=conv, user=user)


class ConversationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        _ensure_saved_messages_chat(self.request.user)
        return (
            Conversation.objects.filter(members__user=self.request.user)
            .distinct()
            .prefetch_related(
                Prefetch("members", queryset=ConversationMember.objects.select_related("user"))
            )
            .order_by("-id")
        )

    @action(detail=False, methods=["post"], url_path="create-group")
    def create_group(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        title = (request.data.get("title") or "").strip()
        staff_ids = request.data.get("staff_ids") or []
        if not isinstance(staff_ids, list):
            return Response({"detail": "staff_ids must be a list"}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            conv = Conversation.objects.create(
                title=title,
                is_group=True,
                is_saved_messages=False,
                is_client_correspondence=False,
                organization=request.user,
            )
            ConversationMember.objects.create(conversation=conv, user=request.user)
            for sid in staff_ids:
                u = User.objects.filter(pk=sid).first()
                if u and u.id != request.user.id:
                    ConversationMember.objects.get_or_create(conversation=conv, user=u)
        conv = self.get_queryset().get(pk=conv.pk)
        return Response(
            ConversationSerializer(conv, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        conv = self.get_object()
        mid = request.data.get("message_id")
        if mid is None:
            mid = Message.objects.filter(conversation=conv).aggregate(m=Max("id"))["m"]
        mem = ConversationMember.objects.filter(conversation=conv, user=request.user).first()
        if not mem:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if mid is not None:
            mid = int(mid)
            cur = mem.last_read_message_id or 0
            mem.last_read_message_id = max(cur, mid)
            mem.save(update_fields=["last_read_message_id"])
        User.objects.filter(pk=request.user.id).update(last_seen_at=timezone.now())
        mem.refresh_from_db()
        return Response({"ok": True, "last_read_message_id": mem.last_read_message_id})

    @action(detail=False, methods=["post"], url_path="create-direct")
    def create_direct(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        staff_id = request.data.get("staff_id")
        if not staff_id:
            return Response({"detail": "staff_id required"}, status=status.HTTP_400_BAD_REQUEST)
        staff_user = User.objects.filter(pk=staff_id).first()
        if not staff_user:
            return Response({"detail": "Пользователь не найден."}, status=status.HTTP_400_BAD_REQUEST)
        if not ProviderStaff.objects.filter(
            provider=request.user,
            staff=staff_user,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        ).exists():
            return Response({"detail": "Сотрудник не найден."}, status=status.HTTP_400_BAD_REQUEST)
        candidates = (
            Conversation.objects.filter(
                is_group=False,
                is_saved_messages=False,
                is_client_correspondence=False,
                organization=request.user,
            )
            .prefetch_related("members")
        )
        for c in candidates:
            user_ids = {m.user_id for m in c.members.all()}
            if user_ids == {request.user.id, staff_user.id}:
                return Response(
                    ConversationSerializer(c, context={"request": request}).data,
                    status=status.HTTP_200_OK,
                )
        with transaction.atomic():
            conv = Conversation.objects.create(
                title="",
                is_group=False,
                is_saved_messages=False,
                is_client_correspondence=False,
                organization=request.user,
            )
            ConversationMember.objects.create(conversation=conv, user=request.user)
            ConversationMember.objects.create(conversation=conv, user=staff_user)
        conv = self.get_queryset().get(pk=conv.pk)
        return Response(
            ConversationSerializer(conv, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="create-with-client")
    def create_with_client(self, request):
        """Чат организации с клиентом (папка «Клиенты»)."""
        if request.user.role not in ("provider", "staff"):
            return Response(status=status.HTTP_403_FORBIDDEN)
        client_id = request.data.get("client_id")
        if not client_id:
            return Response({"detail": "client_id required"}, status=status.HTTP_400_BAD_REQUEST)
        client_user = User.objects.filter(pk=client_id, role=User.Role.CLIENT).first()
        if not client_user:
            return Response({"detail": "Клиент не найден."}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role == "provider":
            provider = request.user
        else:
            link = ProviderStaff.objects.filter(
                staff=request.user,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            ).first()
            if not link:
                return Response(status=status.HTTP_403_FORBIDDEN)
            provider = link.provider
        if not staff_can_access_client_chats(request.user, provider):
            return Response(status=status.HTTP_403_FORBIDDEN)
        conv, _ = get_or_create_client_conversation(provider, client_user)
        conv = self.get_queryset().get(pk=conv.pk)
        return Response(
            ConversationSerializer(conv, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="create-with-provider")
    def create_with_provider(self, request):
        if request.user.role != User.Role.CLIENT:
            return Response(status=status.HTTP_403_FORBIDDEN)
        provider_id = request.data.get("provider_id")
        if not provider_id:
            return Response({"detail": "provider_id required"}, status=status.HTTP_400_BAD_REQUEST)
        provider = User.objects.filter(pk=provider_id, role=User.Role.PROVIDER).first()
        if not provider:
            return Response({"detail": "Организация не найдена."}, status=status.HTTP_400_BAD_REQUEST)
        conv, _ = get_or_create_client_conversation(provider, request.user)
        conv = self.get_queryset().get(pk=conv.pk)
        return Response(
            ConversationSerializer(conv, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        cid = self.request.query_params.get("conversation")
        peer_rid = 0
        if cid:
            try:
                conv = (
                    Conversation.objects.filter(pk=int(cid), members__user=self.request.user)
                    .prefetch_related("members")
                    .distinct()
                    .get()
                )
                others = [m for m in conv.members.all() if m.user_id != self.request.user.id]
                if len(others) == 1:
                    peer_rid = others[0].last_read_message_id or 0
                elif conv.is_saved_messages:
                    # Один участник — ты; для исходящих «просмотр» = твой last_read в этом чате.
                    me_m = next(
                        (m for m in conv.members.all() if m.user_id == self.request.user.id),
                        None,
                    )
                    if me_m is not None:
                        peer_rid = me_m.last_read_message_id or 0
            except (Conversation.DoesNotExist, ValueError, TypeError):
                pass
        ctx["peer_last_read_message_id"] = peer_rid
        return ctx

    def get_queryset(self):
        cid = self.request.query_params.get("conversation")
        if not cid:
            return Message.objects.none()
        if not Conversation.objects.filter(pk=cid, members__user=self.request.user).exists():
            return Message.objects.none()
        return (
            Message.objects.filter(conversation_id=cid)
            .select_related("sender", "conversation")
            .order_by("created_at", "id")
        )

    def perform_create(self, serializer):
        conv_id = serializer.validated_data["conversation"].id
        if not Conversation.objects.filter(pk=conv_id, members__user=self.request.user).exists():
            raise PermissionDenied()
        serializer.save(sender=self.request.user)
        User.objects.filter(pk=self.request.user.id).update(last_seen_at=timezone.now())


class ChatActivitySummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        pending = []
        if user.role in (User.Role.STAFF, User.Role.CLIENT):
            qs = ProviderStaff.objects.filter(
                staff=user,
                invitation_status=ProviderStaff.InvitationStatus.PENDING,
            ).select_related("provider")
            pending = ProviderStaffSerializer(qs, many=True, context={"request": request}).data
        notes = list(
            InAppNotification.objects.filter(user=user, read=False).order_by("-created_at")[:40]
        )
        notif_data = [
            {
                "id": n.id,
                "kind": n.kind,
                "payload": n.payload,
                "created_at": n.created_at.isoformat(),
            }
            for n in notes
        ]
        from .services import count_unread_chat_messages

        unread_n = InAppNotification.objects.filter(user=user, read=False).count()
        pending_n = len(pending)
        unread_chat = count_unread_chat_messages(user)
        return Response(
            {
                "pending_staff_invites": pending,
                "notifications": notif_data,
                "unread_notification_count": unread_n,
                "pending_invite_count": pending_n,
                "unread_chat_messages_count": unread_chat,
                "badge_count": unread_n + pending_n + unread_chat,
            }
        )
