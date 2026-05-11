from rest_framework import serializers

from .models import Conversation, ConversationMember, Message


class ConversationMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = ConversationMember
        fields = ["id", "user", "username", "first_name", "last_name"]


class ConversationSerializer(serializers.ModelSerializer):
    members = ConversationMemberSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()

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
        )

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


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "conversation", "sender", "text", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]
