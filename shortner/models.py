
import hashlib
from django.db import models

class URLMapping(models.Model):
    short_code  = models.CharField(max_length=15, unique=True, db_index=True)
    long_url    = models.TextField()
    long_url_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    click_count = models.PositiveBigIntegerField(default=0)

    class Meta:
        db_table = "url_mapping"
        indexes = [
            models.Index(fields=["short_code", "long_url"], name="idx_covering_redirect"),     # B-tree: redirect lookup
            models.Index(fields=["long_url_hash"], name="idx_long_url_hash"),  # B-tree: duplicate detection
        ]

    def save(self, *args, **kwargs):
        if not self.long_url_hash:
            self.long_url_hash = hashlib.sha256(
                self.long_url.encode()
            ).hexdigest()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.short_code} → {self.long_url[:50]}"
    


class ClickEvent(models.Model):
    short_code= models.CharField(max_length=15, db_index=True)
    ip_address= models.GenericIPAddressField(null=True)
    user_agent= models.TextField(null=True)
    clicked_at= models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table= "click_events"
        indexes= [models.Index(fields=['short_code',"clicked_at"])]
