from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment, PromoRedemption, SubscriptionPlan, UserSubscription
from .promos import PROMO_CODES, normalize_promo_code
from .serializers import PaymentSerializer, SubscriptionPlanSerializer, UserSubscriptionSerializer
from .yookassa_client import create_payment, create_refund, get_payment


def _activate_subscription(subscription: UserSubscription, *, days: int | None = None):
    now = timezone.now()
    if days is None:
        if subscription.source == UserSubscription.Source.TRIAL:
            days = subscription.plan.trial_days or 7
        else:
            days = 30
    subscription.status = UserSubscription.Status.ACTIVE
    subscription.period_start = now
    subscription.period_end = now + timedelta(days=int(days))
    subscription.reminder_3d_sent = False
    subscription.reminder_1d_sent = False
    subscription.save(
        update_fields=[
            "status",
            "period_start",
            "period_end",
            "reminder_3d_sent",
            "reminder_1d_sent",
            "updated_at",
        ]
    )


def _user_has_trial(user) -> bool:
    return UserSubscription.objects.filter(
        user=user, source=UserSubscription.Source.TRIAL
    ).exists()


def _user_has_promo(user, code: str) -> bool:
    return PromoRedemption.objects.filter(user=user, code=normalize_promo_code(code)).exists()


def _create_payment_for_plan(user, plan):
    if plan.plan_type == SubscriptionPlan.PlanType.TRIAL:
        return None, {"detail": "Пробный период активируется отдельно, без оплаты."}
    if plan.plan_type == SubscriptionPlan.PlanType.CUSTOM or plan.price_monthly <= 0:
        return None, {"detail": "Для этого тарифа оставьте заявку на индивидуальную автоматизацию."}

    subscription = UserSubscription.objects.create(
        user=user,
        plan=plan,
        status=UserSubscription.Status.PENDING,
        source=UserSubscription.Source.PAID,
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
        if settings.DEBUG and not settings.YOOKASSA_SHOP_ID:
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
        detail = (
            "ЮKassa не настроена на сервере (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY)."
            if not settings.YOOKASSA_SHOP_ID
            else "Не удалось создать платёж. Попробуйте позже."
        )
        return None, {"detail": detail}

    payment.yookassa_payment_id = yk.get("id", "")
    payment.confirmation_url = (yk.get("confirmation") or {}).get("confirmation_url", "")
    payment.save(update_fields=["yookassa_payment_id", "confirmation_url"])
    return payment, {
        "payment_id": payment.id,
        "confirmation_url": payment.confirmation_url,
    }


def _same_day_refund_eligible(sub: UserSubscription) -> Payment | None:
    """Paid same calendar day, not trial/promo → refundable payment."""
    if sub.source != UserSubscription.Source.PAID:
        return None
    if sub.plan.slug == "starter" or sub.plan.plan_type == SubscriptionPlan.PlanType.TRIAL:
        return None
    if not sub.period_start:
        return None
    today = timezone.localdate()
    if timezone.localtime(sub.period_start).date() != today:
        return None
    payment = (
        Payment.objects.filter(
            subscription=sub,
            status=Payment.Status.SUCCEEDED,
            amount__gt=0,
        )
        .order_by("-paid_at", "-id")
        .first()
    )
    if not payment or not payment.paid_at:
        return None
    if timezone.localtime(payment.paid_at).date() != today:
        return None
    if payment.refunded_at:
        return None
    return payment


def _try_refund_payment(payment: Payment) -> bool:
    if not payment.yookassa_payment_id:
        # DEBUG / test payments without YooKassa
        if settings.DEBUG and not settings.YOOKASSA_SHOP_ID:
            payment.status = Payment.Status.REFUNDED
            payment.refunded_at = timezone.now()
            payment.save(update_fields=["status", "refunded_at"])
            return True
        return False
    yk = create_refund(
        payment_id=payment.yookassa_payment_id,
        amount=str(payment.amount),
        description="Возврат при досрочной отмене в день оплаты",
    )
    if not yk:
        return False
    payment.status = Payment.Status.REFUNDED
    payment.refunded_at = timezone.now()
    payment.yookassa_refund_id = yk.get("id", "") or ""
    payment.save(update_fields=["status", "refunded_at", "yookassa_refund_id"])
    return True


class PlansListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True)
        trial_used = False
        if request.user and request.user.is_authenticated:
            trial_used = _user_has_trial(request.user)

        out = []
        for plan in plans:
            item = SubscriptionPlanSerializer(plan).data
            if plan.plan_type == SubscriptionPlan.PlanType.TRIAL or plan.slug == "starter":
                item["trial_available"] = not trial_used
                if trial_used and request.user and request.user.is_authenticated:
                    continue
            out.append(item)
        return Response(out)


class MySubscriptionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subs = UserSubscription.objects.filter(user=request.user).select_related("plan")
        return Response(
            {
                "subscriptions": UserSubscriptionSerializer(subs, many=True).data,
                "trial_used": _user_has_trial(request.user),
                "promo_used_codes": list(
                    PromoRedemption.objects.filter(user=request.user).values_list("code", flat=True)
                ),
            }
        )


class MyPaymentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        payments = Payment.objects.filter(user=request.user).select_related("plan").order_by("-created_at")[:20]
        return Response(PaymentSerializer(payments, many=True).data)


class ActivateTrialView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if _user_has_trial(request.user):
            return Response(
                {"detail": "Пробный период «Старт» можно активировать только один раз."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        plan = SubscriptionPlan.objects.filter(
            slug="starter", is_active=True
        ).first() or SubscriptionPlan.objects.filter(
            plan_type=SubscriptionPlan.PlanType.TRIAL, is_active=True
        ).first()
        if not plan:
            return Response({"detail": "Пробный тариф не найден."}, status=status.HTTP_404_NOT_FOUND)

        active = UserSubscription.objects.filter(
            user=request.user, status=UserSubscription.Status.ACTIVE
        ).filter(period_end__gt=timezone.now()).exists()
        if active:
            return Response(
                {"detail": "У вас уже есть активная подписка. Пробный период можно включить, когда она закончится."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            sub = UserSubscription.objects.create(
                user=request.user,
                plan=plan,
                status=UserSubscription.Status.PENDING,
                source=UserSubscription.Source.TRIAL,
                auto_renew=False,
            )
            _activate_subscription(sub, days=plan.trial_days or 7)

        return Response(
            {
                "detail": f"Пробный период «{plan.name}» активирован на {plan.trial_days or 7} дн.",
                "subscription": UserSubscriptionSerializer(sub).data,
            }
        )


class ApplyPromoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = normalize_promo_code(request.data.get("code") or "")
        if not code:
            return Response({"detail": "Введите промокод."}, status=status.HTTP_400_BAD_REQUEST)
        promo = PROMO_CODES.get(code)
        if not promo:
            return Response({"detail": "Такого промокода нет."}, status=status.HTTP_400_BAD_REQUEST)
        if _user_has_promo(request.user, code):
            return Response(
                {"detail": "Вы уже активировали этот промокод."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan = SubscriptionPlan.objects.filter(slug=promo["plan_slug"], is_active=True).first()
        if not plan:
            return Response({"detail": "Тариф для промокода не найден."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            # End other active paid/trial periods when applying promo month
            UserSubscription.objects.filter(
                user=request.user,
                status=UserSubscription.Status.ACTIVE,
            ).update(
                status=UserSubscription.Status.CANCELLED,
                auto_renew=False,
                cancel_at_period_end=False,
                updated_at=timezone.now(),
            )
            sub = UserSubscription.objects.create(
                user=request.user,
                plan=plan,
                status=UserSubscription.Status.PENDING,
                source=UserSubscription.Source.PROMO,
                promo_code=code,
                auto_renew=False,
            )
            _activate_subscription(sub, days=int(promo.get("days") or 30))
            PromoRedemption.objects.create(user=request.user, code=code, subscription=sub)

        return Response(
            {
                "detail": f"Промокод применён: {promo.get('label') or code}.",
                "subscription": UserSubscriptionSerializer(sub).data,
            }
        )


class CreatePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get("plan_id")
        plan = SubscriptionPlan.objects.filter(id=plan_id, is_active=True).first()
        if not plan:
            return Response({"detail": "Тариф не найден."}, status=status.HTTP_404_NOT_FOUND)

        payment, result = _create_payment_for_plan(request.user, plan)
        if not payment:
            code = status.HTTP_400_BAD_REQUEST if "заявку" in result.get("detail", "") or "Пробный" in result.get("detail", "") else status.HTTP_503_SERVICE_UNAVAILABLE
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
                    payment.subscription.source = UserSubscription.Source.PAID
                    payment.subscription.save(update_fields=["source", "updated_at"])
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
        plan = sub.plan
        if plan.plan_type == SubscriptionPlan.PlanType.TRIAL:
            plan = SubscriptionPlan.objects.filter(slug="business", is_active=True).first() or plan
        payment, result = _create_payment_for_plan(request.user, plan)
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

        refund_info = None
        sub.auto_renew = False
        if immediate:
            payment = _same_day_refund_eligible(sub)
            if payment:
                ok = _try_refund_payment(payment)
                if ok:
                    sub.refunded_at = timezone.now()
                    refund_info = "Деньги за оплату в этот день возвращены."
                else:
                    refund_info = "Не удалось оформить автоматический возврат — напишите в поддержку."
            sub.status = UserSubscription.Status.CANCELLED
            sub.cancel_at_period_end = False
            detail = "Подписка отключена."
            if refund_info:
                detail = f"{detail} {refund_info}"
            update_fields = ["status", "auto_renew", "cancel_at_period_end", "updated_at"]
            if sub.refunded_at:
                update_fields.append("refunded_at")
            sub.save(update_fields=update_fields)
        else:
            sub.cancel_at_period_end = True
            end = sub.period_end.strftime("%d.%m.%Y") if sub.period_end else "окончания оплаченного периода"
            detail = f"Автопродление отключено. Подписка действует до {end}."
            sub.save(update_fields=["status", "auto_renew", "cancel_at_period_end", "updated_at"])

        return Response(
            {
                "detail": detail,
                "subscription": UserSubscriptionSerializer(sub).data,
                "refunded": bool(sub.refunded_at),
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
        if sub.source in (UserSubscription.Source.TRIAL, UserSubscription.Source.PROMO):
            return Response(
                {"detail": "Для пробного периода и промокода автопродление недоступно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
                payment.subscription.source = UserSubscription.Source.PAID
                payment.subscription.save(update_fields=["source", "updated_at"])
                _activate_subscription(payment.subscription)
        return Response({"detail": "ok"})
