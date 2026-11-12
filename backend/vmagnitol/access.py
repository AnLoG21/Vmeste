ALLOWED_USERNAMES = {"a.loginov150"}


def user_can_vmagnitol(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    username = str(getattr(user, "username", "") or "").strip().lower()
    return username in ALLOWED_USERNAMES