from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from booking.models import ProviderStaff

from .models import Conversation, ConversationMember, Message
from .serializers import ConversationSerializer, MessageSerializer

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
        return Response(ConversationSerializer(conv).data, status=status.HTTP_201_CREATED)

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
            provider=request.user, staff=staff_user, is_active=True
        ).exists():
            return Response({"detail": "Сотрудник не найден."}, status=status.HTTP_400_BAD_REQUEST)
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
        return Response(ConversationSerializer(conv).data, status=status.HTTP_201_CREATED)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

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
