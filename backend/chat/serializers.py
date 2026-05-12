from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import Conversation, ConversationMember, Message

ONLINE_WINDOW = timedelta(seconds=120)


class ConversationMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    patronymic = serializers.CharField(source="user.patronymic", read_only=True)
    last_seen_at = serializers.DateTimeField(source="user.last_seen_at", read_only=True)
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = ConversationMember
        fields = [
            "id",
            "user",
            "username",
            "first_name",
            "last_name",
            "patronymic",
            "last_read_message_id",
            "last_seen_at",
            "is_online",
        ]

    def get_is_online(self, obj):
        ts = getattr(obj.user, "last_seen_at", None)
        if not ts:
            return False
        return ts >= timezone.now() - ONLINE_WINDOW


class ConversationSerializer(serializers.ModelSerializer):
    members = ConversationMemberSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    org_direct_peer_status = serializers.SerializerMethodField()
    unread_message_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id",
            "title",
            "is_group",
            "is_saved_messages",
            "is_client_correspondence",
            "organization",
            "created_at",
            "members",
            "last_message",
            "org_direct_peer_status",
            "unread_message_count",
        )
        read_only_fields = (
            "id",
            "title",
            "is_group",
            "is_saved_messages",
            "is_client_correspondence",
            "organization",
            "created_at",
            "members",
            "last_message",
            "org_direct_peer_status",
            "unread_message_count",
        )

    def get_org_direct_peer_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.is_group or obj.is_saved_messages or obj.is_client_correspondence:
            return None
        members = list(obj.members.all())
        if len(members) != 2:
            return None
        peer_m = next((m for m in members if m.user_id != request.user.id), None)
        if not peer_m:
            return None
        u = peer_m.user
        ts = getattr(u, "last_seen_at", None)
        online = bool(ts and ts >= timezone.now() - ONLINE_WINDOW)
        return {
            "is_online": online,
            "last_seen_at": ts.isoformat() if ts else None,
        }

    def get_last_message(self, obj):
        m = (
            Message.objects.filter(conversation=obj)
            .select_related("sender")
            .order_by("-created_at", "-id")
            .first()
        )
        if not m:
            return None
        return {
            "id": m.id,
            "text": (m.text or "")[:240],
            "created_at": m.created_at,
            "sender_id": m.sender_id,
        }

    def get_unread_message_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        my_mem = next((m for m in obj.members.all() if m.user_id == request.user.id), None)
        if not my_mem:
            return 0
        rid = my_mem.last_read_message_id or 0
        return Message.objects.filter(conversation_id=obj.id, id__gt=rid).count()


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    sender_first_name = serializers.CharField(source="sender.first_name", read_only=True)
    sender_last_name = serializers.CharField(source="sender.last_name", read_only=True)
    sender_patronymic = serializers.CharField(source="sender.patronymic", read_only=True)
    viewed_by_peer = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "text",
            "created_at",
            "sender_username",
            "sender_first_name",
            "sender_last_name",
            "sender_patronymic",
            "viewed_by_peer",
        ]
        read_only_fields = [
            "id",
            "sender",
            "created_at",
            "sender_username",
            "sender_first_name",
            "sender_last_name",
            "sender_patronymic",
            "viewed_by_peer",
        ]

    def get_viewed_by_peer(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.sender_id != request.user.id:
            return None
        rid = self.context.get("peer_last_read_message_id")
        if rid is None:
            return False
        return rid >= obj.id
