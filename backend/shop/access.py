from booking.models import ProviderStaff
from users.models import User


SHOP_SPHERES = {
    User.ProviderSphere.HAIR_SALON,
    User.ProviderSphere.SERVICE_CENTER,
    User.ProviderSphere.SHOPS,
}


def staff_org_provider(user):
    return (
        ProviderStaff.objects.filter(
            staff=user,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        )
        .select_related("provider")
        .first()
    )


def resolve_shop_provider(user):
    if user.role == User.Role.PROVIDER:
        return user
    if user.role == User.Role.STAFF:
        link = staff_org_provider(user)
        return link.provider if link else None
    return None


def provider_sphere_allows_shop(provider) -> bool:
    if not provider:
        return False
    return getattr(provider, "provider_sphere", None) in SHOP_SPHERES


def can_manage_shop(user) -> bool:
    provider = resolve_shop_provider(user)
    if not provider or not provider_sphere_allows_shop(provider):
        return False
    if user.role == User.Role.PROVIDER:
        return True
    if user.role == User.Role.STAFF:
        link = staff_org_provider(user)
        if not link:
            return False
        perms = link.permissions if isinstance(link.permissions, dict) else {}
        return bool(perms.get("manage_services") or perms.get("manage_shop"))
    return False
