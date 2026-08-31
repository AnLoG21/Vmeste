from users.models import User

from .models import VmenuFollow, VmenuProfile


def can_message_user(viewer: User, target: User) -> bool:
    if viewer.id == target.id:
        return False
    try:
        profile = target.vmenu_profile
    except VmenuProfile.DoesNotExist:
        profile = VmenuProfile.objects.create(user=target)
    policy = profile.allow_messages
    if policy == VmenuProfile.MessagePolicy.NOBODY:
        return False
    if policy == VmenuProfile.MessagePolicy.EVERYONE:
        return True
    return VmenuFollow.objects.filter(follower=viewer, following=target).exists()
