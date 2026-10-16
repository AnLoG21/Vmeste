"""Fetch official Avito/Cian partner XML feeds from env URLs and upsert listings."""

from __future__ import annotations

import urllib.error
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from vkvartire.feeds import parse_avito_xml, parse_cian_xml, upsert_listing_dicts


def _download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Vmeste-Vkvartire/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


class Command(BaseCommand):
    help = "Import listings from VKUARTIRE_AVITO_FEED_URL / VKUARTIRE_CIAN_FEED_URL (official partner XML)"

    def add_arguments(self, parser):
        parser.add_argument("--avito-url", default="", help="Override Avito feed URL")
        parser.add_argument("--cian-url", default="", help="Override Cian feed URL")
        parser.add_argument("--dry-run", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        avito_url = (options["avito_url"] or getattr(settings, "VKUARTIRE_AVITO_FEED_URL", "") or "").strip()
        cian_url = (options["cian_url"] or getattr(settings, "VKUARTIRE_CIAN_FEED_URL", "") or "").strip()
        if not avito_url and not cian_url:
            self.stdout.write(
                self.style.WARNING(
                    "No feed URLs. Set VKUARTIRE_AVITO_FEED_URL / VKUARTIRE_CIAN_FEED_URL or pass --avito-url/--cian-url"
                )
            )
            return

        total_c = total_u = total_s = 0

        if avito_url:
            self.stdout.write(f"Fetching Avito feed: {avito_url}")
            try:
                raw = _download(avito_url)
                rows = parse_avito_xml(raw)
                self.stdout.write(f"  parsed {len(rows)} ads")
                if options["dry_run"]:
                    total_s += len(rows)
                else:
                    c, u, s = upsert_listing_dicts(rows, source_default="avito")
                    total_c += c
                    total_u += u
                    total_s += s
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Avito feed failed: {e}"))

        if cian_url:
            self.stdout.write(f"Fetching Cian feed: {cian_url}")
            try:
                raw = _download(cian_url)
                rows = parse_cian_xml(raw)
                self.stdout.write(f"  parsed {len(rows)} offers")
                if options["dry_run"]:
                    total_s += len(rows)
                else:
                    c, u, s = upsert_listing_dicts(rows, source_default="cian")
                    total_c += c
                    total_u += u
                    total_s += s
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Cian feed failed: {e}"))

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS(f"Dry-run OK, rows seen≈{total_s}"))
            transaction.set_rollback(True)
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Feeds done: created={total_c}, updated={total_u}, skipped={total_s}")
            )
