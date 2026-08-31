from django.contrib import admin

from .models import (
    VmenuCategory,
    VmenuComment,
    VmenuFollow,
    VmenuProfile,
    VmenuRecipe,
)

admin.site.register(VmenuCategory)
admin.site.register(VmenuProfile)
admin.site.register(VmenuRecipe)
admin.site.register(VmenuComment)
admin.site.register(VmenuFollow)
