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
        meta = obj.get("metadata") or {}
        if meta.get("type") == "booking" or meta.get("booking_id"):
            from booking.acquiring import mark_booking_paid
            from booking.models import Booking

            booking = Booking.objects.filter(yookassa_payment_id=yk_id).first()
            if not booking and meta.get("booking_id"):
                booking = Booking.objects.filter(pk=meta.get("booking_id")).first()
            if booking:
                mark_booking_paid(booking)
                return Response({"detail": "ok"})
        if meta.get("type") == "cafe_order" or (not Payment.objects.filter(yookassa_payment_id=yk_id).exists()):
            from cafe.models import CafeOrder
            from cafe.receipt_service import send_order_receipt_after_payment

            cafe_order = CafeOrder.objects.filter(yookassa_payment_id=yk_id).first()
            if cafe_order:
                was_paid = cafe_order.status == CafeOrder.Status.PAID
                if cafe_order.status != CafeOrder.Status.PAID:
                    cafe_order.status = CafeOrder.Status.PAID
                    cafe_order.paid_at = timezone.now()
                    cafe_order.save(update_fields=["status", "paid_at", "updated_at"])
                if not was_paid:
                    send_order_receipt_after_payment(cafe_order)
                return Response({"detail": "ok"})

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


def _mark_cafe_paid_by_payment_id(payment_id: str, meta: dict | None = None) -> bool:
    from cafe.models import CafeOrder
    from cafe.receipt_service import send_order_receipt_after_payment

    cafe_order = CafeOrder.objects.filter(yookassa_payment_id=payment_id).first()
    if not cafe_order and meta and meta.get("order_id"):
        cafe_order = CafeOrder.objects.filter(pk=meta.get("order_id")).first()
    if not cafe_order:
        return False
    was_paid = cafe_order.status == CafeOrder.Status.PAID
    if cafe_order.status != CafeOrder.Status.PAID:
        cafe_order.status = CafeOrder.Status.PAID
        cafe_order.paid_at = timezone.now()
        cafe_order.save(update_fields=["status", "paid_at", "updated_at"])
    if not was_paid:
        send_order_receipt_after_payment(cafe_order)
    return True


def _mark_booking_paid_by_payment_id(payment_id: str, meta: dict | None = None) -> bool:
    from booking.acquiring import mark_booking_paid
    from booking.models import Booking

    booking = Booking.objects.filter(yookassa_payment_id=payment_id).first()
    if not booking and meta and meta.get("booking_id"):
        booking = Booking.objects.filter(pk=meta.get("booking_id")).first()
    if not booking:
        return False
    mark_booking_paid(booking)
    return True


class TBankWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from booking.models import ProviderAcquiring
        from cafe.models import CafeSettings
        from payments.gateway import verify_tbank_token

        data = request.data if isinstance(request.data, dict) else {}
        status_name = str(data.get("Status") or "").upper()
        payment_id = str(data.get("PaymentId") or "")
        terminal = str(data.get("TerminalKey") or "")
        if status_name not in ("CONFIRMED", "AUTHORIZED"):
            return Response("OK")
        password = ""
        acq = ProviderAcquiring.objects.filter(tbank_terminal_key=terminal).first()
        if acq:
            password = acq.tbank_password or ""
        else:
            cafe = CafeSettings.objects.filter(tbank_terminal_key=terminal).first()
            if cafe:
                password = cafe.tbank_password or ""
        if password and not verify_tbank_token(dict(data), password):
            return Response({"detail": "bad token"}, status=status.HTTP_400_BAD_REQUEST)
        meta = data.get("DATA") if isinstance(data.get("DATA"), dict) else {}
        if _mark_booking_paid_by_payment_id(payment_id, meta) or _mark_cafe_paid_by_payment_id(payment_id, meta):
            return Response("OK")
        order_id = str(data.get("OrderId") or "")
        if order_id.startswith("b") and order_id[1:].isdigit():
            if _mark_booking_paid_by_payment_id(payment_id, {"booking_id": order_id[1:]}):
                return Response("OK")
        if order_id.startswith("c") and order_id[1:].isdigit():
            if _mark_cafe_paid_by_payment_id(payment_id, {"order_id": order_id[1:]}):
                return Response("OK")
        return Response("OK")


class CloudPaymentsWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from booking.models import ProviderAcquiring
        from cafe.models import CafeSettings
        from payments.gateway import verify_cloudpayments_hmac

        raw = request.body or b""
        sig = request.headers.get("Content-HMAC") or request.headers.get("X-Content-HMAC") or ""
        data = request.data if isinstance(request.data, dict) else {}
        invoice = str(data.get("InvoiceId") or data.get("InvoiceID") or "")
        tx = str(data.get("TransactionId") or data.get("TransactionID") or "")
        secrets_list = list(
            ProviderAcquiring.objects.exclude(cloudpayments_api_secret="")
            .values_list("cloudpayments_api_secret", flat=True)[:50]
        ) + list(
            CafeSettings.objects.exclude(cloudpayments_api_secret="")
            .values_list("cloudpayments_api_secret", flat=True)[:50]
        )
        if secrets_list and not any(verify_cloudpayments_hmac(raw, sig, s) for s in secrets_list):
            return Response({"code": 13})
        if invoice.startswith("b") and invoice[1:].isdigit():
            _mark_booking_paid_by_payment_id(tx or invoice, {"booking_id": invoice[1:]})
        elif invoice.startswith("c") and invoice[1:].isdigit():
            _mark_cafe_paid_by_payment_id(tx or invoice, {"order_id": invoice[1:]})
        else:
            _mark_booking_paid_by_payment_id(tx or invoice) or _mark_cafe_paid_by_payment_id(tx or invoice)
        return Response({"code": 0})


class RobokassaWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        return self._handle(request)

    def get(self, request):
        return self._handle(request)

    def _handle(self, request):
        from django.http import HttpResponse

        from booking.models import ProviderAcquiring
        from cafe.models import CafeSettings
        from payments.gateway import verify_robokassa_result

        src = request.data if request.method == "POST" and request.data else request.query_params
        out_sum = str(src.get("OutSum") or "")
        inv_id = str(src.get("InvId") or "")
        signature = str(src.get("SignatureValue") or "")
        shp = {k: str(src.get(k)) for k in src.keys() if str(k).startswith("Shp_")}
        password2 = ""
        for acq in ProviderAcquiring.objects.exclude(robokassa_password2="")[:80]:
            if verify_robokassa_result(
                out_sum=out_sum, inv_id=inv_id, signature=signature, password2=acq.robokassa_password2, shp=shp
            ):
                password2 = acq.robokassa_password2
                break
        if not password2:
            for cafe in CafeSettings.objects.exclude(robokassa_password2="")[:80]:
                if verify_robokassa_result(
                    out_sum=out_sum, inv_id=inv_id, signature=signature, password2=cafe.robokassa_password2, shp=shp
                ):
                    password2 = cafe.robokassa_password2
                    break
        if not password2:
            return Response("bad sign", status=status.HTTP_400_BAD_REQUEST)
        meta_type = shp.get("Shp_type") or ""
        booking_id = shp.get("Shp_booking_id") or ""
        order_id = shp.get("Shp_order_id") or ""
        if meta_type == "booking" or booking_id:
            _mark_booking_paid_by_payment_id(inv_id, {"booking_id": booking_id})
        elif meta_type == "cafe_order" or order_id:
            _mark_cafe_paid_by_payment_id(inv_id, {"order_id": order_id})
        else:
            _mark_booking_paid_by_payment_id(inv_id) or _mark_cafe_paid_by_payment_id(inv_id)
        return HttpResponse(f"OK{inv_id}")
