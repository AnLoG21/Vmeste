"""Import listings from JSON file. Dedup by fingerprint / (source, external_id)."""

from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from vkvartire.feeds import upsert_listing_dicts
from vkvartire.models import Listing


class Command(BaseCommand):
    help = "Import listings from JSON array. Fields mirror Listing model + photos:[url,...]"

    def add_arguments(self, parser):
        parser.add_argument("path", type=str, help="Path to JSON file")
        parser.add_argument(
            "--source-default",
            default="other",
            choices=[c[0] for c in Listing.Source.choices],
        )

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.exists():
            raise CommandError(f"File not found: {path}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise CommandError("JSON root must be an array of listings")
        created, updated, skipped = upsert_listing_dicts(payload, source_default=options["source_default"])
        self.stdout.write(
            self.style.SUCCESS(f"Import done: created={created}, updated={updated}, skipped={skipped}")
        )
