from django.urls import path
from .views import ShortenURLView, RedirectView, StatsView

urlpatterns = [
    path("api/v1/shorten/", ShortenURLView.as_view(), name="shorten"),
    path("api/v1/stats/<str:short_code>", StatsView.as_view(), name="stats"),
    path("<str:short_code>", RedirectView.as_view(), name="redirect"),
]