from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import redirect
from django.http import Http404, JsonResponse, HttpResponseRedirect

from django.db.models import Count
from .models import ClickEvent, URLMapping
from .serializers import ShortenRequestSerializer, ShortenResponseSerializer
from .services import shorten_url, get_long_url
from .cache import get_cached_url
from .tasks import track_click

class ShortenURLView(APIView):
    def post(self, request):
        serializer = ShortenRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        long_url = serializer.validated_data["long_url"]
        mapping = shorten_url(long_url)  # returns URLMapping object

        response = ShortenResponseSerializer(mapping)
        return Response(response.data, status=status.HTTP_201_CREATED)


class RedirectView(APIView):
    def get(self, request, short_code):
        cached = get_cached_url(short_code)
    
        if cached:
            response = HttpResponseRedirect(cached)
            response["X-Cache"] = "HIT"
            return response

        long_url =get_long_url(short_code)
        if not long_url:
            return JsonResponse({"error": "not found"}, status=404)
        
        track_click.delay(
            short_code=short_code,
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", "")
        )

        response = HttpResponseRedirect(long_url)
        response["X-Cache"] = "MISS"
        return response
    

# views.py

class StatsView(APIView):
    def get(self, request, short_code):
        mapping = URLMapping.objects.filter(short_code=short_code).first()
        if not mapping:
            raise Http404

        clicks_by_day = (
            ClickEvent.objects
            .filter(short_code=short_code)
            .extra(select={"day": "DATE(clicked_at)"})
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        return Response({
            "short_code": short_code,
            "long_url": mapping.long_url,
            "total_clicks": mapping.click_count,
            "clicks_by_day": list(clicks_by_day)
        })