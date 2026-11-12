from rest_framework.permissions import BasePermission

from .access import user_can_vmagnitol


class IsVmagnitolAllowed(BasePermission):
    message = "Вмагнитоле доступен только по личному доступу."

    def has_permission(self, request, view):
        return user_can_vmagnitol(request.user)