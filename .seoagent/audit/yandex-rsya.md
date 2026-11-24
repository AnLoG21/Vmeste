---
title: Виджет РСЯ (partner.yandex.ru) из Вебмастера
date: 2026-11-24
status: wired_blog_off
---

# РСЯ / partner.yandex.ru

Монетизация баннерами. **Money pages запрещены.** Слот встроен только в блог, по умолчанию выключен.

## Куда встроено
- Скрипт: `frontend/public/rsya-blog.js`
- Конфиг: `frontend/public/rsya-config.json` (`enabled: false` пока нет blockId)
- Слот `#yandex_rtb_blog` перед футером во всех `frontend/public/blog/*.html` + `blog.html`
- Скрипт сам no-op на `/`, `/salon`, `/avtoservis`, `/kafe`, `/businesses`

## Как включить (владелец)
1. Зарегистрировать площадку на https://partner.yandex.ru/
2. Создать рекламный блок → взять `pageNumber` / `blockId`
3. В `rsya-config.json`: `"enabled": true`, заполнить поля
4. Задеплоить frontend

## Почему не на лендингах
Конверсия в регистрацию важнее CPM; CLS/реклама на CTA-страницах вредны.
