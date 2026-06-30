from rest_framework import serializers
from .models import URLMapping

class ShortenRequestSerializer(serializers.Serializer):
    long_url = serializers.URLField()  # validates it's a proper URL

class ShortenResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = URLMapping
        fields = ["short_code", "long_url", "created_at"]