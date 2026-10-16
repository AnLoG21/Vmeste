"""Seed demo Moscow listings for Вквартире MVP."""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from vkvartire.models import Listing, ListingPhoto

# Unsplash-style placeholder apartment photos (stable CDN)
PHOTOS = [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
]

SEED = [
    {
        "deal_type": "rent",
        "rooms": 1,
        "price": 65000,
        "area_m2": "38.0",
        "floor": 5,
        "floors_total": 12,
        "address": "Москва, ул. Тверская, 12",
        "lat": 55.7578,
        "lon": 37.6151,
        "metro_name": "Тверская",
        "metro_walk_min": 7,
        "description": "Светлая однушка у Тверской. Мебель, техника, интернет.",
        "source": "manual",
        "is_agent": False,
    },
    {
        "deal_type": "rent",
        "rooms": 2,
        "price": 95000,
        "area_m2": "54.5",
        "floor": 9,
        "floors_total": 17,
        "address": "Москва, Ленинградский пр-т, 36",
        "lat": 55.7885,
        "lon": 37.5582,
        "metro_name": "Динамо",
        "metro_walk_min": 10,
        "description": "Двушка с видом во двор. Можно с питомцем.",
        "source": "manual",
        "is_agent": True,
    },
    {
        "deal_type": "rent",
        "rooms": 0,
        "price": 48000,
        "area_m2": "24.0",
        "floor": 3,
        "floors_total": 9,
        "address": "Москва, ул. Арбат, 20",
        "lat": 55.7494,
        "lon": 37.5915,
        "metro_name": "Арбатская",
        "metro_walk_min": 5,
        "description": "Студия в центре, идеально для одного.",
        "source": "manual",
        "is_agent": False,
    },
    {
        "deal_type": "sale",
        "rooms": 2,
        "price": 18500000,
        "area_m2": "62.0",
        "floor": 8,
        "floors_total": 22,
        "address": "Москва, Пресненская наб., 8с1",
        "lat": 55.7473,
        "lon": 37.5395,
        "metro_name": "Деловой центр",
        "metro_walk_min": 8,
        "description": "Квартира в Москва-Сити, евроремонт.",
        "source": "manual",
        "is_agent": True,
    },
    {
        "deal_type": "sale",
        "rooms": 3,
        "price": 22900000,
        "area_m2": "78.0",
        "floor": 4,
        "floors_total": 9,
        "address": "Москва, ул. Большая Полянка, 30",
        "lat": 55.7342,
        "lon": 37.6198,
        "metro_name": "Полянка",
        "metro_walk_min": 6,
        "description": "Трёхкомнатная у парка. Балкон, кладовка.",
        "source": "manual",
        "is_agent": False,
    },
    {
        "deal_type": "rent",
        "rooms": 3,
        "price": 140000,
        "area_m2": "85.0",
        "floor": 12,
        "floors_total": 25,
        "address": "Москва, пр-т Мира, 119",
        "lat": 55.8290,
        "lon": 37.6320,
        "metro_name": "ВДНХ",
        "metro_walk_min": 12,
        "description": "Просторная семья, рядом ВДНХ.",
        "source": "manual",
        "is_agent": False,
    },
    {
        "deal_type": "sale",
        "rooms": 1,
        "price": 11200000,
        "area_m2": "41.0",
        "floor": 2,
        "floors_total": 14,
        "address": "Москва, ул. Профсоюзная, 56",
        "lat": 55.6775,
        "lon": 37.5628,
        "metro_name": "Новые Черёмушки",
        "metro_walk_min": 9,
        "description": "Однушка под ключ, чистая продажа.",
        "source": "manual",
        "is_agent": False,
    },
    {
        "deal_type": "rent",
        "rooms": 2,
        "price": 78000,
        "area_m2": "50.0",
        "floor": 6,
        "floors_total": 16,
        "address": "Москва, ул. Вавилова, 19",
        "lat": 55.7035,
        "lon": 37.5865,
        "metro_name": "Ленинский проспект",
        "metro_walk_min": 11,
        "description": "Уютная двушка, тихий двор.",
        "source": "manual",
        "is_agent": True,
    },
]


class Command(BaseCommand):
    help = "Seed demo listings for Вквартире (Moscow)"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete manual seed listings first")

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            Listing.objects.filter(source=Listing.Source.MANUAL, external_id__startswith="seed-").delete()
            self.stdout.write("Cleared previous seed listings.")

        created = 0
        for i, row in enumerate(SEED):
            ext = f"seed-{i + 1}"
            fp = Listing.make_fingerprint(
                address=row["address"],
                rooms=row["rooms"],
                area_m2=row["area_m2"],
                price=row["price"],
                deal_type=row["deal_type"],
            )
            existing = Listing.objects.filter(source=Listing.Source.MANUAL, external_id=ext).first()
            if not existing:
                existing = Listing.objects.filter(fingerprint=fp, is_active=True).first()
            if existing:
                for k, v in row.items():
                    if k == "area_m2":
                        setattr(existing, k, Decimal(v))
                    else:
                        setattr(existing, k, v)
                existing.external_id = ext
                existing.fingerprint = fp
                existing.is_active = True
                existing.save()
                listing = existing
            else:
                listing = Listing.objects.create(
                    **{
                        **row,
                        "area_m2": Decimal(row["area_m2"]),
                        "external_id": ext,
                        "fingerprint": fp,
                    }
                )
                created += 1

            if not listing.photos.exists():
                for j, url in enumerate(PHOTOS[i % len(PHOTOS) :][:3] or PHOTOS[:3]):
                    ListingPhoto.objects.create(listing=listing, url=url, sort_order=j)
                # ensure 3 photos cycling
                while listing.photos.count() < 3:
                    idx = listing.photos.count()
                    ListingPhoto.objects.create(
                        listing=listing, url=PHOTOS[(i + idx) % len(PHOTOS)], sort_order=idx
                    )

        self.stdout.write(self.style.SUCCESS(f"Seed done. New listings: {created}. Total active: {Listing.objects.filter(is_active=True).count()}"))
