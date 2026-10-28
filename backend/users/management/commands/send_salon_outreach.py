"""Send salon outreach emails via project SMTP (same as registration / notifications)."""

from __future__ import annotations

import csv
import json
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from users.email_service import _can_send, is_demo_mailbox, send_outreach_email


def _default_mail_merge() -> Path:
    here = Path(__file__).resolve()
    backend = here.parents[3]  # .../backend/users/management/commands -> backend
    bundled = backend / "data" / "outreach" / "mail-merge.json"
    if bundled.exists():
        return bundled
    repo = here.parents[4]
    return repo / "research" / "moscow-beauty-salons" / "mail-merge.json"


def _load_rows(path: Path) -> list[dict]:
    if not path.exists():
        raise CommandError(f"Файл не найден: {path}")
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        if isinstance(data, dict) and "items" in data:
            data = data["items"]
        if not isinstance(data, list):
            raise CommandError("JSON должен быть массивом писем или {items: [...]}")
        return data
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))
    raise CommandError("Нужен .json или .csv")


class Command(BaseCommand):
    help = (
        "Рассылка outreach салонам через EMAIL_* SMTP проекта "
        "(тот же канал, что регистрация и уведомления)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default="",
            help="Путь к mail-merge.json / outreach-email.csv (по умолчанию research/.../mail-merge.json)",
        )
        parser.add_argument(
            "--priority",
            action="append",
            default=[],
            help="Фильтр приоритета, можно несколько: --priority P1 --priority P3",
        )
        parser.add_argument("--limit", type=int, default=0, help="Максимум писем (0 = все)")
        parser.add_argument(
            "--offset",
            type=int,
            default=0,
            help="Пропустить первые N после фильтра",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=2.0,
            help="Пауза между письмами, сек (Gmail лимиты)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Только показать, кого бы отправили",
        )
        parser.add_argument(
            "--to",
            type=str,
            default="",
            help="Переопределить получателя (тест на свой ящик: все письма уйдут сюда)",
        )

    def handle(self, *args, **options):
        if not _can_send() and not options["dry_run"]:
            raise CommandError(
                "SMTP не настроен: задайте EMAIL_HOST_USER и EMAIL_HOST_PASSWORD "
                "(как для регистрации). Локально — в .env, на VPS — в env контейнера web."
            )

        path = Path(options["file"]).expanduser() if options["file"] else _default_mail_merge()
        rows = _load_rows(path)
        priorities = {p.strip().upper() for p in (options["priority"] or []) if p.strip()}
        if priorities:
            rows = [r for r in rows if str(r.get("priority") or "").upper() in priorities]

        rows = [r for r in rows if (r.get("email") or "").strip() and "@" in str(r.get("email"))]
        rows = rows[options["offset"] :]
        if options["limit"] and options["limit"] > 0:
            rows = rows[: options["limit"]]

        if not rows:
            raise CommandError("После фильтров список пуст.")

        self.stdout.write(
            f"SMTP: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}  "
            f"from={settings.DEFAULT_FROM_EMAIL}"
        )
        self.stdout.write(f"Файл: {path}  писем: {len(rows)}  dry_run={options['dry_run']}")

        sent = 0
        skipped = 0
        failed = 0
        override = (options["to"] or "").strip()

        for i, row in enumerate(rows, 1):
            email = override or str(row.get("email") or "").strip()
            subject = str(row.get("subject") or "").strip() or "Вместе для салона"
            body = str(row.get("body") or "").strip()
            name = str(row.get("business_name") or "").strip()
            if is_demo_mailbox(email):
                self.stdout.write(self.style.WARNING(f"[{i}] skip demo {email}"))
                skipped += 1
                continue
            if not body:
                self.stdout.write(self.style.WARNING(f"[{i}] skip empty body {email}"))
                skipped += 1
                continue

            label = f"[{i}/{len(rows)}] {name or email} → {email}"
            if options["dry_run"]:
                self.stdout.write(f"{label}\n  subject: {subject[:80]}")
                sent += 1
                continue

            try:
                ok = send_outreach_email(to=email, subject=subject, text_body=body, title=subject)
                if ok:
                    sent += 1
                    self.stdout.write(self.style.SUCCESS(f"{label} OK"))
                else:
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"{label} skipped"))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f"{label} FAIL: {e}"))

            if options["delay"] > 0 and i < len(rows):
                time.sleep(options["delay"])

        self.stdout.write(
            self.style.SUCCESS(f"Готово: sent={sent} skipped={skipped} failed={failed}")
        )
        if failed:
            raise CommandError(f"Не доставлено писем: {failed}")
