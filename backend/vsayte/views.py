import copy
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .entitlement import (
    can_custom_domain,
    can_publish,
    current_limits,
    ensure_free_vsayte_subscription,
)
from .models import Site, SiteAsset, SiteDomain, SiteLead, SitePublish
from .notifications import notify_owner_new_lead
from .publish import publish_site, sites_root, unpublish_site
from . import regru
from .serializers import (
    SiteAssetSerializer,
    SiteDetailSerializer,
    SiteDomainSerializer,
    SiteLeadCreateSerializer,
    SiteLeadSerializer,
    SiteListSerializer,
    SiteWriteSerializer,
)


def _owned_site(user, pk) -> Site:
    return get_object_or_404(Site.objects.filter(owner=user), pk=pk)


def _subdomain_hostname(slug: str) -> str:
    base = getattr(settings, "VSAYTE_BASE_DOMAIN", "vsayte.vsevmeste.space")
    return f"{slug}.{base}"


class EntitlementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ensure_free_vsayte_subscription(request.user)
        limits = current_limits(request.user)
        return Response(
            {
                "limits": limits,
                "can_publish": bool(limits.get("can_publish")),
                "can_custom_domain": bool(limits.get("can_custom_domain")),
                "editor_tier": limits.get("editor_tier"),
                "full_access": bool(limits.get("full_access")),
                "max_pages": int(limits.get("max_pages") or 2),
                "base_domain": getattr(settings, "VSAYTE_BASE_DOMAIN", "vsayte.vsevmeste.space"),
            }
        )


class SiteListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q

        ensure_free_vsayte_subscription(request.user)
        qs = (
            Site.objects.filter(owner=request.user)
            .prefetch_related("domains")
            .annotate(unread_leads_count=Count("leads", filter=Q(leads__is_read=False)))
        )
        return Response(SiteListSerializer(qs, many=True).data)

    def post(self, request):
        ensure_free_vsayte_subscription(request.user)
        limits = current_limits(request.user)
        count = Site.objects.filter(owner=request.user).count()
        if count >= int(limits.get("max_sites") or 1):
            return Response(
                {"detail": f"Лимит сайтов на тарифе «{limits.get('plan_name')}»: {limits.get('max_sites')}."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ser = SiteWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        title = ser.validated_data.get("title") or "Новый сайт"
        slug = ser.validated_data.get("slug") or ""
        if not slug:
            base = slugify(title, allow_unicode=False) or "site"
            slug = base[:60]
            n = 1
            while Site.objects.filter(slug=slug).exists():
                n += 1
                slug = f"{base[:50]}-{n}"

        site = Site.objects.create(
            owner=request.user,
            title=title,
            slug=slug,
            document=ser.validated_data.get("document") or {},
            template_id=ser.validated_data.get("template_id") or "",
        )
        return Response(SiteDetailSerializer(site).data, status=status.HTTP_201_CREATED)


class SiteDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        site = _owned_site(request.user, pk)
        return Response(SiteDetailSerializer(site).data)

    def patch(self, request, pk):
        site = _owned_site(request.user, pk)
        ser = SiteWriteSerializer(site, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for field, value in ser.validated_data.items():
            setattr(site, field, value)
        if "document" in ser.validated_data:
            pages = (site.document or {}).get("pages") or []
            limits = current_limits(request.user)
            if isinstance(pages, list) and len(pages) > int(limits.get("max_pages") or 2):
                return Response(
                    {"detail": f"Лимит страниц: {limits.get('max_pages')}."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        site.save()
        return Response(SiteDetailSerializer(site).data)

    def delete(self, request, pk):
        site = _owned_site(request.user, pk)
        if site.status == Site.Status.PUBLISHED:
            unpublish_site(site)
        site.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SitePublishView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        site = _owned_site(request.user, pk)
        if not can_publish(request.user):
            return Response(
                {
                    "detail": "Публикация доступна на тарифах «Хостинг» и «Pro». "
                    "На бесплатном тарифе сайт работает только локально."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            storage_path, checksum = publish_site(site)
            last = site.publishes.aggregate(m=Max("version")).get("m") or 0
            pub = SitePublish.objects.create(
                site=site,
                version=last + 1,
                storage_path=storage_path,
                checksum=checksum,
            )
            site.status = Site.Status.PUBLISHED
            site.published_at = timezone.now()
            site.save(update_fields=["status", "published_at", "updated_at"])

            hostname = _subdomain_hostname(site.slug)
            domain, _ = SiteDomain.objects.get_or_create(
                site=site,
                kind=SiteDomain.Kind.SUBDOMAIN,
                defaults={"hostname": hostname, "status": SiteDomain.Status.ACTIVE},
            )
            if domain.hostname != hostname or domain.status != SiteDomain.Status.ACTIVE:
                domain.hostname = hostname
                domain.status = SiteDomain.Status.ACTIVE
                domain.last_error = ""
                domain.save(update_fields=["hostname", "status", "last_error", "updated_at"])

        data = SiteDetailSerializer(site).data
        data["publish"] = {
            "version": pub.version,
            "checksum": pub.checksum,
            "url": f"https://{hostname}",
        }
        return Response(data)


class SiteUnpublishView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        site = _owned_site(request.user, pk)
        unpublish_site(site)
        site.status = Site.Status.UNPUBLISHED
        site.save(update_fields=["status", "updated_at"])
        SiteDomain.objects.filter(site=site, kind=SiteDomain.Kind.SUBDOMAIN).update(
            status=SiteDomain.Status.PENDING
        )
        return Response(SiteDetailSerializer(site).data)


class SiteLeadListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        site = _owned_site(request.user, pk)
        qs = site.leads.all()[:200]
        return Response(SiteLeadSerializer(qs, many=True).data)


class SiteLeadReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, lead_id):
        site = _owned_site(request.user, pk)
        lead = get_object_or_404(SiteLead.objects.filter(site=site), pk=lead_id)
        lead.is_read = True
        lead.save(update_fields=["is_read"])
        return Response(SiteLeadSerializer(lead).data)


class PublicSiteLeadCreateView(APIView):
    """Публичный приём заявок с опубликованного сайта (по slug)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, slug):
        site = get_object_or_404(Site.objects.all(), slug=slug)
        if site.status != Site.Status.PUBLISHED:
            return Response(
                {"detail": "Сайт не опубликован."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = SiteLeadCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        # простой антиспам: лимит 30 заявок / час с одного IP
        ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get(
            "REMOTE_ADDR"
        )
        if ip:
            hour_ago = timezone.now() - timedelta(hours=1)
            recent = SiteLead.objects.filter(site=site, ip_address=ip, created_at__gte=hour_ago).count()
            if recent >= 30:
                return Response(
                    {"detail": "Слишком много заявок. Попробуйте позже."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
        lead = SiteLead.objects.create(
            site=site,
            name=data.get("name") or "",
            contact=data.get("contact") or "",
            message=data.get("message") or "",
            payload=data.get("payload") or {},
            page_url=(data.get("page_url") or "")[:500],
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:400],
            ip_address=ip or None,
        )
        notify_owner_new_lead(site, lead)
        return Response({"ok": True, "id": lead.id}, status=status.HTTP_201_CREATED)


class SiteCloneView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        source = _owned_site(request.user, pk)
        ensure_free_vsayte_subscription(request.user)
        limits = current_limits(request.user)
        count = Site.objects.filter(owner=request.user).count()
        if count >= int(limits.get("max_sites") or 1):
            return Response(
                {"detail": f"Лимит сайтов на тарифе «{limits.get('plan_name')}»: {limits.get('max_sites')}."},
                status=status.HTTP_403_FORBIDDEN,
            )
        title = f"{source.title} — копия"
        base = slugify(title, allow_unicode=False) or f"{source.slug}-copy"
        slug = base[:60]
        n = 1
        while Site.objects.filter(slug=slug).exists():
            n += 1
            slug = f"{base[:50]}-{n}"
        cloned = Site.objects.create(
            owner=request.user,
            title=title,
            slug=slug,
            document=copy.deepcopy(source.document or {}),
            template_id=source.template_id or "",
            status=Site.Status.DRAFT,
        )
        return Response(SiteDetailSerializer(cloned).data, status=status.HTTP_201_CREATED)


class SiteAssetUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, pk):
        site = _owned_site(request.user, pk)
        assets = site.assets.all()
        return Response(SiteAssetSerializer(assets, many=True, context={"request": request}).data)

    def post(self, request, pk):
        site = _owned_site(request.user, pk)
        limits = current_limits(request.user)
        if site.assets.count() >= int(limits.get("max_assets") or 5):
            return Response(
                {"detail": f"Лимит файлов: {limits.get('max_assets')}."},
                status=status.HTTP_403_FORBIDDEN,
            )
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "Файл не передан."}, status=status.HTTP_400_BAD_REQUEST)
        max_bytes = int(limits.get("max_asset_bytes") or 1_000_000)
        if upload.size > max_bytes:
            return Response(
                {"detail": f"Файл слишком большой. Максимум {max_bytes} байт на вашем тарифе."},
                status=status.HTTP_403_FORBIDDEN,
            )
        asset = SiteAsset.objects.create(
            site=site,
            file=upload,
            original_name=getattr(upload, "name", "") or "",
            content_type=getattr(upload, "content_type", "") or "",
            size_bytes=int(upload.size or 0),
        )
        return Response(
            SiteAssetSerializer(asset, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class DomainCheckView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not can_custom_domain(request.user):
            return Response(
                {"detail": "Свои домены доступны на тарифе Pro."},
                status=status.HTTP_403_FORBIDDEN,
            )
        domain = (request.data.get("domain") or "").strip().lower()
        return Response(regru.check_domain(domain))


class DomainPurchaseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        site = _owned_site(request.user, pk)
        if not can_custom_domain(request.user):
            return Response(
                {"detail": "Свои домены доступны на тарифе Pro."},
                status=status.HTTP_403_FORBIDDEN,
            )
        domain = (request.data.get("domain") or "").strip().lower()
        if not domain:
            return Response({"detail": "Укажите домен."}, status=status.HTTP_400_BAD_REQUEST)

        check = regru.check_domain(domain)
        if not check.get("available") and not check.get("mock"):
            return Response(
                {"detail": check.get("detail") or "Домен недоступен.", "check": check},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reg = regru.register_domain(domain)
        if not reg.get("ok"):
            return Response(
                {"detail": reg.get("detail") or "Не удалось заказать домен.", "result": reg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ip = getattr(settings, "VSAYTE_HOST_IP", "") or ""
        dns = regru.set_dns_a(domain, ip) if ip else {"ok": True, "skipped": True}

        obj, _ = SiteDomain.objects.update_or_create(
            hostname=domain,
            defaults={
                "site": site,
                "kind": SiteDomain.Kind.CUSTOM,
                "status": SiteDomain.Status.ACTIVE if reg.get("ok") else SiteDomain.Status.PENDING,
                "regru_order_id": reg.get("order_id") or "",
                "regru_service_id": reg.get("service_id") or "",
                "last_error": "" if dns.get("ok") else (dns.get("detail") or ""),
            },
        )
        return Response(
            {
                "domain": SiteDomainSerializer(obj).data,
                "registration": reg,
                "dns": dns,
            },
            status=status.HTTP_201_CREATED,
        )


class DomainAttachView(APIView):
    """Attach an already-owned custom domain (manual DNS)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        site = _owned_site(request.user, pk)
        if not can_custom_domain(request.user):
            return Response(
                {"detail": "Свои домены доступны на тарифе Pro."},
                status=status.HTTP_403_FORBIDDEN,
            )
        domain = (request.data.get("domain") or "").strip().lower()
        if not domain:
            return Response({"detail": "Укажите домен."}, status=status.HTTP_400_BAD_REQUEST)
        if SiteDomain.objects.filter(hostname=domain).exclude(site=site).exists():
            return Response({"detail": "Домен уже привязан к другому сайту."}, status=status.HTTP_400_BAD_REQUEST)

        obj, _ = SiteDomain.objects.update_or_create(
            hostname=domain,
            defaults={
                "site": site,
                "kind": SiteDomain.Kind.CUSTOM,
                "status": SiteDomain.Status.ACTIVE,
                "last_error": "",
            },
        )
        return Response(SiteDomainSerializer(obj).data, status=status.HTTP_201_CREATED)


class ResolveHostView(APIView):
    """Public: map host → site slug / storage path for Caddy routing."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        host = (request.query_params.get("host") or request.META.get("HTTP_HOST") or "").split(":")[0].lower()
        if not host:
            return Response({"ok": False}, status=status.HTTP_400_BAD_REQUEST)

        domain = SiteDomain.objects.filter(hostname=host, status=SiteDomain.Status.ACTIVE).select_related("site").first()
        if not domain or domain.site.status != Site.Status.PUBLISHED:
            # Also accept slug.base
            base = getattr(settings, "VSAYTE_BASE_DOMAIN", "vsayte.vsevmeste.space")
            if host.endswith("." + base):
                slug = host[: -(len(base) + 1)]
                site = Site.objects.filter(slug=slug, status=Site.Status.PUBLISHED).first()
                if site:
                    return Response({"ok": True, "slug": site.slug, "site_id": site.id})
            return Response({"ok": False}, status=status.HTTP_404_NOT_FOUND)
        return Response({"ok": True, "slug": domain.site.slug, "site_id": domain.site_id})


class TlsAskView(APIView):
    """Caddy on_demand TLS ask: 200 if hostname is an active custom domain."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        domain = (request.query_params.get("domain") or "").strip().lower()
        if not domain:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        ok = SiteDomain.objects.filter(
            hostname=domain,
            kind=SiteDomain.Kind.CUSTOM,
            status=SiteDomain.Status.ACTIVE,
            site__status=Site.Status.PUBLISHED,
        ).exists()
        if ok:
            return Response({"ok": True})
        return Response({"ok": False}, status=status.HTTP_404_NOT_FOUND)


class ServePublishedView(APIView):
    """Serve published static HTML for custom domains (Host header)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, path=""):
        host = (request.query_params.get("host") or request.META.get("HTTP_HOST") or "").split(":")[0].lower()
        if not host:
            raise Http404()

        site = None
        domain = (
            SiteDomain.objects.filter(hostname=host, status=SiteDomain.Status.ACTIVE)
            .select_related("site")
            .first()
        )
        if domain and domain.site.status == Site.Status.PUBLISHED:
            site = domain.site
        else:
            base = getattr(settings, "VSAYTE_BASE_DOMAIN", "vsayte.vsevmeste.space")
            if host.endswith("." + base):
                slug = host[: -(len(base) + 1)]
                site = Site.objects.filter(slug=slug, status=Site.Status.PUBLISHED).first()

        if not site:
            raise Http404()

        root = sites_root() / site.slug
        rel = (path or "").lstrip("/")
        if not rel or rel.endswith("/"):
            candidate = root / rel / "index.html"
        else:
            candidate = root / rel
            if not candidate.exists() and (root / rel / "index.html").exists():
                candidate = root / rel / "index.html"
        if not candidate.exists():
            candidate = root / "index.html"
        if not candidate.exists() or not candidate.is_file():
            return HttpResponse("Site not published", status=404, content_type="text/plain")

        # Prevent path traversal
        try:
            candidate.resolve().relative_to(root.resolve())
        except Exception as exc:  # noqa: BLE001
            raise Http404() from exc

        content_type = "text/html; charset=utf-8"
        if candidate.suffix == ".css":
            content_type = "text/css"
        elif candidate.suffix in {".js"}:
            content_type = "application/javascript"
        elif candidate.suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
            return FileResponse(candidate.open("rb"))
        return HttpResponse(candidate.read_text(encoding="utf-8"), content_type=content_type)
