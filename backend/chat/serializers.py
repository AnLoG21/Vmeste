from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import Conversation, ConversationMember, Message
from .services import message_preview_text

ONLINE_WINDOW = timedelta(seconds=120)


class ConversationMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    patronymic = serializers.CharField(source="user.patronymic", read_only=True)
    organization_name = serializers.CharField(source="user.organization_name", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
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
            "organization_name",
            "role",
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
            "user_id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "patronymic": getattr(u, "patronymic", "") or "",
            "organization_name": getattr(u, "organization_name", "") or "",
            "role": u.role,
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
            "text": message_preview_text(m),
            "kind": m.kind,
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


def infer_message_kind(file_obj, explicit_kind=""):
    kind = (explicit_kind or "").strip().lower()
    allowed = {c.value for c in Message.Kind}
    if kind in allowed and kind != Message.Kind.TEXT:
        return kind
    if not file_obj:
        return Message.Kind.TEXT
    name = (getattr(file_obj, "name", "") or "").lower()
    ctype = (getattr(file_obj, "content_type", "") or "").lower()
    if kind == Message.Kind.VIDEO_NOTE or name.endswith(".webm") and "video" in ctype:
        if "video_note" in name or kind == Message.Kind.VIDEO_NOTE:
            return Message.Kind.VIDEO_NOTE
    if ctype.startswith("image/") or name.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic")):
        return Message.Kind.IMAGE
    if ctype.startswith("video/") or name.endswith((".mp4", ".mov", ".webm", ".mkv")):
        return Message.Kind.VIDEO_NOTE if kind == Message.Kind.VIDEO_NOTE else Message.Kind.VIDEO
    if ctype.startswith("audio/") or name.endswith((".ogg", ".oga", ".mp3", ".m4a", ".wav", ".webm")):
        return Message.Kind.VOICE
    return Message.Kind.FILE


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    sender_first_name = serializers.CharField(source="sender.first_name", read_only=True)
    sender_last_name = serializers.CharField(source="sender.last_name", read_only=True)
    sender_patronymic = serializers.CharField(source="sender.patronymic", read_only=True)
    viewed_by_peer = serializers.SerializerMethodField()
    display_text = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "kind",
            "payload",
            "text",
            "display_text",
            "attachment",
            "attachment_url",
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
            "display_text",
            "attachment_url",
            "created_at",
            "sender_username",
            "sender_first_name",
            "sender_last_name",
            "sender_patronymic",
            "viewed_by_peer",
        ]
        extra_kwargs = {
            "attachment": {"required": False, "allow_null": True},
            "kind": {"required": False},
            "payload": {"required": False},
            "text": {"required": False, "allow_blank": True},
        }

    def get_display_text(self, obj):
        if obj.kind == Message.Kind.REVIEW_REPLY:
            payload = obj.payload or {}
            return (payload.get("reply_text") or obj.text or "").strip()
        return (obj.text or "").strip()

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        # Relative /media/... so the browser uses the public domain (Caddy),
        # not the Docker-internal host from build_absolute_uri().
        return obj.attachment.url

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

    def create(self, validated_data):
        request = self.context.get("request")
        attachment = validated_data.get("attachment")
        explicit_kind = validated_data.pop("kind", None) or (
            request.data.get("kind") if request else None
        )
        kind = infer_message_kind(attachment, explicit_kind)
        validated_data["kind"] = kind
        if not validated_data.get("text"):
            validated_data["text"] = ""
        if validated_data.get("payload") is None:
            validated_data["payload"] = {}
        if attachment and not validated_data["payload"].get("name"):
            validated_data["payload"] = {
                **(validated_data.get("payload") or {}),
                "name": getattr(attachment, "name", "") or "",
                "size": getattr(attachment, "size", 0) or 0,
            }
        return super().create(validated_data)
