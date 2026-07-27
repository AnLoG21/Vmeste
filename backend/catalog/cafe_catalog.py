"""Шаблон каталога записи для сферы кафе (бронь стола / мероприятия — базовый набор)."""

CAFE_RESTAURANT_CATALOG = {
    "sphere": "cafe_restaurant",
    "label": "Кафе и рестораны",
    "categories": [
        {
            "slug": "cafe-booking",
            "name": "Бронирование",
            "subcategories": [
                {
                    "slug": "table-reserve",
                    "name": "Стол",
                    "services": [
                        {
                            "slug": "table-2",
                            "name": "Бронь стола на 2 гостей",
                            "duration_minutes": 90,
                        },
                        {
                            "slug": "table-4",
                            "name": "Бронь стола на 4 гостей",
                            "duration_minutes": 120,
                        },
                        {
                            "slug": "table-6",
                            "name": "Бронь стола на компанию (6+)",
                            "duration_minutes": 150,
                        },
                    ],
                },
            ],
        },
    ],
}
