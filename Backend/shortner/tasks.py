from celery import shared_task
from django.db import models
from .models import ClickEvent, URLMapping

@shared_task
def track_click(short_code: str, ip_address: str, user_agent: str):
    # Save the raw click event
    ClickEvent.objects.create(
        short_code=short_code,
        ip_address=ip_address,
        user_agent=user_agent
    )

    # DB-level increment — avoids race conditions
    URLMapping.objects.filter(short_code=short_code).update(
        click_count=models.F("click_count") + 1
    )
    