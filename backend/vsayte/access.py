"""Allowlist for full Всайте Pro access (bypass paid plan)."""

FULL_ACCESS_USERNAMES = {"a.loginov150"}


def user_has_full_vsayte_access(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    username = str(getattr(user, "username", "") or "").strip().lower()
    return username in FULL_ACCESS_USERNAMES
