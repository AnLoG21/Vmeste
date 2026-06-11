from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment, SubscriptionPlan, UserSubscription
from .serializers import PaymentSerializer, SubscriptionPlanSerializer, UserSubscriptionSerializer
from .yookassa_client import create_payment, get_payment


def _activate_subscription(subscription: UserSubscription):
    now = timezone.now()
    subscription.status = UserSubscription.Status.ACTIVE
    subscription.period_start = now
    subscription.period_end = now + timedelta(days=30)
    subscription.save(update_fields=["status", "period_start", "period_end", "updated_at"])


def _create_payment_for_plan(user, plan):
    if plan.price_monthly <= 0:
        return None, {"detail": "Для этого тарифа оставьте заявку на индивидуальную автоматизацию."}

    subscription = UserSubscription.objects.create(
        user=user,
        plan=plan,
        status=UserSubscription.Status.PENDING,
    )
    payment = Payment.objects.create(
        user=user,
        subscription=subscription,
        plan=plan,
        amount=plan.price_monthly,
        status=Payment.Status.PENDING,
    )

    return_url = f"{settings.FRONTEND_URL}?payment=success&payment_id={payment.id}"
    yk = create_payment(
        amount=str(plan.price_monthly),
        description=f"Подписка Vmeste: {plan.name}",
        return_url=return_url,
        metadata={"payment_id": str(payment.id), "user_id": str(user.id)},
    )

    if not yk:
        if not settings.YOOKASSA_SHOP_ID:
            _activate_subscription(subscription)
            payment.status = Payment.Status.SUCCEEDED
            payment.paid_at = timezone.now()
            payment.save(update_fields=["status", "paid_at"])
            return payment, {
                "detail": "Подписка активирована (тестовый режим без ЮKassa).",
                "subscription": UserSubscriptionSerializer(subscription).data,
            }
        payment.status = Payment.Status.CANCELLED
        payment.save(update_fields=["status"])
        subscription.status = UserSubscription.Status.CANCELLED
        subscription.save(update_fields=["status", "updated_at"])
        return None, {"detail": "Не удалось создать платёж. Попробуйте позже."}

    payment.yookassa_payment_id = yk.get("id", "")
    payment.confirmation_url = (yk.get("confirmation") or {}).get("confirmation_url", "")
    payment.save(update_fields=["yookassa_payment_id", "confirmation_url"])
    return payment, {
        "payment_id": payment.id,
        "confirmation_url": payment.confirmation_url,
    }


class PlansListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True)
        return Response(SubscriptionPlanSerializer(plans, many=True).data)


class MySubscriptionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subs = UserSubscription.objects.filter(user=request.user).select_related("plan")
        return Response(UserSubscriptionSerializer(subs, many=True).data)


class MyPaymentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        payments = Payment.objects.filter(user=request.user).select_related("plan").order_by("-created_at")[:20]
        return Response(PaymentSerializer(payments, many=True).data)


class CreatePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get("plan_id")
        plan = SubscriptionPlan.objects.filter(id=plan_id, is_active=True).first()
        if not plan:
            return Response({"detail": "Тариф не найден."}, status=status.HTTP_404_NOT_FOUND)

        payment, result = _create_payment_for_plan(request.user, plan)
        if not payment:
            code = status.HTTP_400_BAD_REQUEST if "заявку" in result.get("detail", "") else status.HTTP_503_SERVICE_UNAVAILABLE
            return Response(result, status=code)
        if "subscription" in result:
            return Response(result)
        return Response(result)


class ConfirmPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        payment_id = request.data.get("payment_id")
        payment = Payment.objects.filter(id=payment_id, user=request.user).select_related("subscription").first()
        if not payment:
            return Response({"detail": "Платёж не найден."}, status=status.HTTP_404_NOT_FOUND)
        if payment.status == Payment.Status.SUCCEEDED:
            return Response({"detail": "ok", "subscription": UserSubscriptionSerializer(payment.subscription).data})

        if payment.yookassa_payment_id:
            yk = get_payment(payment.yookassa_payment_id)
            if yk and yk.get("status") == "succeeded":
                payment.status = Payment.Status.SUCCEEDED
                payment.paid_at = timezone.now()
                payment.save(update_fields=["status", "paid_at"])
                if payment.subscription:
                    _activate_subscription(payment.subscription)
                return Response(
                    {
                        "detail": "Оплата подтверждена.",
                        "subscription": UserSubscriptionSerializer(payment.subscription).data,
                    }
                )

        return Response({"detail": "Оплата ещё не завершена."}, status=status.HTTP_202_ACCEPTED)


class RenewSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        sub_id = request.data.get("subscription_id")
        sub = UserSubscription.objects.filter(id=sub_id, user=request.user).select_related("plan").first()
        if not sub:
            return Response({"detail": "Подписка не найдена."}, status=status.HTTP_404_NOT_FOUND)
        payment, result = _create_payment_for_plan(request.user, sub.plan)
        if not payment:
            code = status.HTTP_400_BAD_REQUEST if "заявку" in result.get("detail", "") else status.HTTP_503_SERVICE_UNAVAILABLE
            return Response(result, status=code)
        if "subscription" in result:
            return Response(result)
        return Response(result)


class CancelSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        sub_id = request.data.get("subscription_id")
        immediate = bool(request.data.get("immediate", False))
        sub = UserSubscription.objects.filter(id=sub_id, user=request.user).select_related("plan").first()
        if not sub:
            return Response({"detail": "Подписка не найдена."}, status=status.HTTP_404_NOT_FOUND)

        if sub.status == UserSubscription.Status.CANCELLED:
            return Response({"detail": "Подписка уже отключена."})
        if sub.status == UserSubscription.Status.EXPIRED:
            return Response({"detail": "Подписка уже истекла."}, status=status.HTTP_400_BAD_REQUEST)

        if sub.status == UserSubscription.Status.ACTIVE and sub.cancel_at_period_end and not immediate:
            end = sub.period_end.strftime("%d.%m.%Y") if sub.period_end else "окончания периода"
            return Response({"detail": f"Подписка уже отключена и действует до {end}."})

        if sub.status == UserSubscription.Status.PENDING:
            sub.status = UserSubscription.Status.CANCELLED
            sub.auto_renew = False
            sub.cancel_at_period_end = False
            sub.save(update_fields=["status", "auto_renew", "cancel_at_period_end", "updated_at"])
            return Response(
                {
                    "detail": "Ожидающая оплату подписка отменена.",
                    "subscription": UserSubscriptionSerializer(sub).data,
                }
            )

        sub.auto_renew = False
        if immediate:
            sub.status = UserSubscription.Status.CANCELLED
            sub.cancel_at_period_end = False
            detail = "Подписка отключена."
        else:
            sub.cancel_at_period_end = True
            end = sub.period_end.strftime("%d.%m.%Y") if sub.period_end else "окончания оплаченного периода"
            detail = f"Автопродление отключено. Подписка действует до {end}."

        sub.save(update_fields=["status", "auto_renew", "cancel_at_period_end", "updated_at"])
        return Response(
            {
                "detail": detail,
                "subscription": UserSubscriptionSerializer(sub).data,
            }
        )


class ToggleAutoRenewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        sub_id = request.data.get("subscription_id")
        auto_renew = request.data.get("auto_renew", True)
        sub = UserSubscription.objects.filter(id=sub_id, user=request.user).first()
        if not sub:
            return Response({"detail": "Подписка не найдена."}, status=status.HTTP_404_NOT_FOUND)
        sub.auto_renew = bool(auto_renew)
        if sub.auto_renew:
            sub.cancel_at_period_end = False
            sub.save(update_fields=["auto_renew", "cancel_at_period_end", "updated_at"])
        else:
            sub.save(update_fields=["auto_renew", "updated_at"])
        return Response(UserSubscriptionSerializer(sub).data)


class YooKassaWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        event = request.data.get("event")
        obj = request.data.get("object") or {}
        if event != "payment.succeeded":
            return Response({"detail": "ignored"})
        yk_id = obj.get("id")
        payment = Payment.objects.filter(yookassa_payment_id=yk_id).select_related("subscription").first()
        if not payment:
            return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)
        if payment.status != Payment.Status.SUCCEEDED:
            payment.status = Payment.Status.SUCCEEDED
            payment.paid_at = timezone.now()
            payment.save(update_fields=["status", "paid_at"])
            if payment.subscription:
                _activate_subscription(payment.subscription)
        return Response({"detail": "ok"})
