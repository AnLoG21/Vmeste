"""Общие хелперы сидов Вмагнитоле."""

from django.core.files.base import ContentFile

from vmagnitol.models import Guide, GuideFile, GuideStep


def upsert_guide(
    car_model,
    title,
    summary,
    source_url,
    steps,
    *,
    force=True,
    category=Guide.Category.OTHER,
    risk_level=Guide.RiskLevel.MEDIUM,
    verified=Guide.Verified.UNVERIFIED,
    brick_warning="",
    file_manifest="",
    sort_order=0,
    status=Guide.Status.PUBLISHED,
    attachments=None,
):
    """Создаёт/синхронизирует гайд, шаги и текстовые/ссылочные вложения."""
    guide, created = Guide.objects.get_or_create(
        car_model=car_model,
        title=title,
        defaults={
            "summary": summary,
            "status": status,
            "source_url": source_url,
            "category": category,
            "risk_level": risk_level,
            "verified": verified,
            "brick_warning": brick_warning,
            "file_manifest": file_manifest,
            "sort_order": sort_order,
        },
    )
    guide.summary = summary
    guide.status = status
    guide.source_url = source_url
    guide.category = category
    guide.risk_level = risk_level
    guide.verified = verified
    guide.brick_warning = brick_warning
    guide.file_manifest = file_manifest
    guide.sort_order = sort_order
    guide.save()

    if not force and not created and guide.steps.count() > 0:
        return guide, False

    wanted_orders = {step["order"] for step in steps}
    if force and not created:
        guide.steps.exclude(order__in=wanted_orders).delete()

    for step in steps:
        GuideStep.objects.update_or_create(
            guide=guide,
            order=step["order"],
            defaults={
                "title": step["title"],
                "body": step["body"],
                "warning": step.get("warning", ""),
                "stop_if": step.get("stop_if", ""),
            },
        )

    if attachments is not None:
        _sync_attachments(guide, attachments)

    return guide, True


def _sync_attachments(guide, attachments):
    """attachments: list of dicts with title, role, notes, content|external_url, is_required, filename."""
    keep_titles = set()
    for item in attachments:
        title = item["title"]
        keep_titles.add(title)
        role = item.get("role", GuideFile.Role.OTHER)
        notes = item.get("notes", "")
        is_required = bool(item.get("is_required", False))
        external_url = item.get("external_url", "")
        content = item.get("content")
        filename = item.get("filename") or f"{title}.txt"

        obj, _ = GuideFile.objects.get_or_create(
            guide=guide,
            title=title,
            defaults={
                "role": role,
                "notes": notes,
                "is_required": is_required,
                "external_url": external_url,
            },
        )
        obj.role = role
        obj.notes = notes
        obj.is_required = is_required
        obj.external_url = external_url
        if content is not None:
            payload = content if isinstance(content, (bytes, bytearray)) else str(content).encode("utf-8")
            if obj.file:
                obj.file.delete(save=False)
            obj.file.save(filename, ContentFile(payload), save=False)
            obj.original_name = filename
            obj.content_type = "text/plain; charset=utf-8"
            obj.size_bytes = len(payload)
        obj.save()

    if keep_titles:
        guide.files.exclude(title__in=keep_titles).filter(role=GuideFile.Role.MANIFEST).delete()
