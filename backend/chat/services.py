from django.contrib.auth import get_user_model
from django.db import transaction

from booking.models import ProviderStaff

from .models import Conversation, ConversationMember, Message

User = get_user_model()


def get_or_create_client_conversation(provider, client):
    """Общий чат организации с клиентом (папка «Клиенты»)."""
    candidates = (
        Conversation.objects.filter(
            is_group=False,
            is_saved_messages=False,
            is_client_correspondence=True,
            organization=provider,
        )
        .prefetch_related("members")
    )
    for c in candidates:
        user_ids = {m.user_id for m in c.members.all()}
        if user_ids == {provider.id, client.id}:
            return c, False
    with transaction.atomic():
        conv = Conversation.objects.create(
            title="",
            is_group=False,
            is_saved_messages=False,
            is_client_correspondence=True,
            organization=provider,
        )
        ConversationMember.objects.create(conversation=conv, user=provider)
        ConversationMember.objects.create(conversation=conv, user=client)
    return conv, True


def count_unread_chat_messages(user) -> int:
    """Сообщения в чатах пользователя, которые он ещё не прочитал (не свои)."""
    total = 0
    memberships = ConversationMember.objects.filter(user=user).only(
        "conversation_id", "last_read_message_id"
    )
    for mem in memberships:
        last_id = mem.last_read_message_id or 0
        total += (
            Message.objects.filter(conversation_id=mem.conversation_id, id__gt=last_id)
            .exclude(sender_id=user.id)
            .count()
        )
    return total


def message_preview_text(message: Message) -> str:
    if message.kind == Message.Kind.REVIEW_REPLY:
        payload = message.payload or {}
        reply = (payload.get("reply_text") or message.text or "").strip()
        if reply:
            return f"Ответ на отзыв: {reply[:200]}"
        return "Ответ на отзыв"
    if message.kind == Message.Kind.IMAGE:
        return "Фото"
    if message.kind == Message.Kind.VIDEO:
        return "Видео"
    if message.kind == Message.Kind.VIDEO_NOTE:
        return "Кружок"
    if message.kind == Message.Kind.VOICE:
        payload = message.payload or {}
        dur = payload.get("duration_sec")
        return f"Голосовое{': ' + str(dur) + ' c' if dur else ''}"
    if message.kind == Message.Kind.FILE:
        payload = message.payload or {}
        name = payload.get("file_name") or "Файл"
        return f"📎 {name}"
    if message.kind == Message.Kind.LINK:
        return (message.text or (message.payload or {}).get("url") or "Ссылка")[:240]
    return (message.text or "")[:240]


def post_review_reply_in_chat(provider, client, review, reply_text: str, sender=None):
    from booking.booking_actions import client_display_name

    sender = sender or provider
    conv, _ = get_or_create_client_conversation(provider, client)
    from django.conf import settings

    photos = list(review.photos.all()) if hasattr(review, "photos") else []
    photo_paths = []
    for p in photos:
        if not p.image:
            continue
        name = p.image.name
        if name.startswith("http") or name.startswith("/"):
            photo_paths.append(name)
        else:
            photo_paths.append(f"{settings.MEDIA_URL.rstrip('/')}/{name}")
    payload = {
        "review_id": review.id,
        "rating": review.rating,
        "review_text": (review.text or "").strip(),
        "reply_text": (reply_text or "").strip(),
        "client_name": client_display_name(getattr(review, "client", None)),
        "photo_paths": photo_paths,
    }
    return Message.objects.create(
        conversation=conv,
        sender=sender,
        kind=Message.Kind.REVIEW_REPLY,
        payload=payload,
        text=(reply_text or "").strip(),
    )


def post_booking_message(provider, client, text, sender=None):
    if not (text or "").strip():
        return None
    sender = sender or provider
    conv, _ = get_or_create_client_conversation(provider, client)
    return Message.objects.create(
        conversation=conv,
        sender=sender,
        kind=Message.Kind.TEXT,
        text=text.strip(),
    )


def staff_can_access_client_chats(user, provider):
    if user.role == User.Role.PROVIDER and user.id == provider.id:
        return True
    if user.role == User.Role.STAFF:
        link = ProviderStaff.objects.filter(
            provider=provider,
            staff=user,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        ).first()
        if not link:
            return False
        perms = link.permissions or {}
        return bool(perms.get("manage_client_chats", True))
    return False
