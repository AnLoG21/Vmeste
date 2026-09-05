from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .client import NpdError
from .models import MoyNalogAccount, NpdReceipt
from . import service as moy_service


def _provider_only(request):
    return getattr(request.user, "role", None) == "provider"


class MoyNalogStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _provider_only(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        account = MoyNalogAccount.objects.filter(provider=request.user).first()
        return Response(moy_service.account_public_payload(account))

    def patch(self, request):
        if not _provider_only(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if "enabled" in (request.data or {}):
            account = moy_service.set_enabled(request.user, bool(request.data.get("enabled")))
            if not account:
                return Response({"detail": "Сначала подключите «Мой налог»"}, status=status.HTTP_400_BAD_REQUEST)
            return Response(moy_service.account_public_payload(account))
        return Response({"detail": "Нечего обновлять"}, status=status.HTTP_400_BAD_REQUEST)


class MoyNalogConnectPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _provider_only(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        data = request.data or {}
        try:
            account = moy_service.connect_with_password(
                request.user,
                username=str(data.get("username") or data.get("inn") or ""),
                password=str(data.get("password") or ""),
            )
        except NpdError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(moy_service.account_public_payload(account))


class MoyNalogSmsStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _provider_only(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            payload = moy_service.start_sms_login(request.user, phone=str((request.data or {}).get("phone") or ""))
        except NpdError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class MoyNalogSmsVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _provider_only(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        data = request.data or {}
        try:
            account = moy_service.verify_sms_login(
                request.user,
                phone=str(data.get("phone") or ""),
                code=str(data.get("code") or ""),
                challenge_token=str(data.get("challenge_token") or ""),
            )
        except NpdError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(moy_service.account_public_payload(account))


class MoyNalogDisconnectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _provider_only(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        moy_service.disconnect_account(request.user)
        return Response(moy_service.account_public_payload(None))


class MoyNalogReceiptListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _provider_only(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = NpdReceipt.objects.filter(provider=request.user).order_by("-created_at")[:50]
        return Response(
            [
                {
                    "id": r.id,
                    "source": r.source,
                    "source_id": r.source_id,
                    "amount": str(r.amount),
                    "service_name": r.service_name,
                    "status": r.status,
                    "receipt_uuid": r.receipt_uuid,
                    "receipt_url": r.receipt_url,
                    "error_message": r.error_message,
                    "issued_at": r.issued_at.isoformat() if r.issued_at else None,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in qs
            ]
        )


class MoyNalogReceiptRetryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if not _provider_only(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        receipt = NpdReceipt.objects.filter(pk=pk, provider=request.user).first()
        if not receipt:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            receipt = moy_service.retry_receipt(receipt)
        except NpdError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "id": receipt.id,
                "status": receipt.status,
                "receipt_uuid": receipt.receipt_uuid,
                "receipt_url": receipt.receipt_url,
                "error_message": receipt.error_message,
            }
        )
