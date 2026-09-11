from django.contrib import admin, messages
from django.utils.html import format_html

from .client_booking_views import import_clients_from_upload
from .models import (
    AvailabilitySlot,
    Booking,
    ClientMigrateRequest,
    ProviderAcquiring,
    ProviderStaff,
)


admin.site.register(AvailabilitySlot)
admin.site.register(Booking)
admin.site.register(ProviderAcquiring)
admin.site.register(ProviderStaff)


@admin.register(ClientMigrateRequest)
class ClientMigrateRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "provider", "status", "has_file", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("provider__username", "provider__organization_name", "source_note", "result_detail")
    readonly_fields = ("created_at", "updated_at", "file_link")
    actions = ("mark_in_progress", "import_file_and_done", "mark_rejected")
    fields = (
        "provider",
        "status",
        "source_note",
        "file",
        "file_link",
        "result_detail",
        "created_at",
        "updated_at",
    )

    @admin.display(boolean=True, description="Файл")
    def has_file(self, obj):
        return bool(obj.file)

    @admin.display(description="Скачать файл")
    def file_link(self, obj):
        if not obj.file:
            return "—"
        try:
            return format_html('<a href="{}" target="_blank">{}</a>', obj.file.url, obj.file.name)
        except Exception:
            return obj.file.name

    @admin.action(description="Взять в работу")
    def mark_in_progress(self, request, queryset):
        updated = queryset.exclude(status=ClientMigrateRequest.Status.DONE).update(
            status=ClientMigrateRequest.Status.IN_PROGRESS
        )
        self.message_user(request, f"В работе: {updated}", messages.SUCCESS)

    @admin.action(description="Отклонить")
    def mark_rejected(self, request, queryset):
        updated = queryset.update(status=ClientMigrateRequest.Status.REJECTED)
        self.message_user(request, f"Отклонено: {updated}", messages.WARNING)

    @admin.action(description="Импортировать файл и завершить")
    def import_file_and_done(self, request, queryset):
        ok_n = 0
        fail_n = 0
        for obj in queryset:
            if not obj.file:
                fail_n += 1
                obj.status = ClientMigrateRequest.Status.IN_PROGRESS
                obj.result_detail = ((obj.result_detail or "").strip() + "\nНет файла для импорта.").strip()
                obj.save(update_fields=["status", "result_detail", "updated_at"])
                continue
            try:
                obj.file.open("rb")
                try:
                    if hasattr(obj.file, "seek"):
                        obj.file.seek(0)
                    ok, payload = import_clients_from_upload(obj.provider_id, obj.file)
                finally:
                    try:
                        obj.file.close()
                    except Exception:
                        pass
            except Exception as e:
                ok, payload = False, {"detail": str(e)}

            if ok:
                ok_n += 1
                obj.status = ClientMigrateRequest.Status.DONE
                obj.result_detail = payload.get("detail") or "Импорт выполнен."
                if payload.get("errors"):
                    obj.result_detail += f" Ошибки строк: {len(payload['errors'])}."
            else:
                fail_n += 1
                obj.status = ClientMigrateRequest.Status.IN_PROGRESS
                obj.result_detail = payload.get("detail") or "Ошибка импорта."
            obj.save(update_fields=["status", "result_detail", "updated_at"])

        self.message_user(
            request,
            f"Импорт: успешно {ok_n}, с ошибками {fail_n}",
            messages.SUCCESS if fail_n == 0 else messages.WARNING,
        )
