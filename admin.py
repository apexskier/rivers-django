from django.contrib import admin
import rivers.models

admin.site.register(rivers.models.River)
admin.site.register(rivers.models.MarkerType)
admin.site.register(rivers.models.Marker)
admin.site.register(rivers.models.Rapid)
admin.site.register(rivers.models.Playspot)
admin.site.register(rivers.models.Gauge)
admin.site.register(rivers.models.Run)
