import hashlib
from .models import URLMapping
from .snowflake import generate_short_code
from .cache import get_cached_url, set_cached_url, COLD_TTL, REDIRECT_TTL
from django.db.models import F

def shorten_url(long_url: str) -> URLMapping:
    # Duplicate detection via hash (Component 4)
    url_hash = hashlib.sha256(long_url.encode()).hexdigest()
    
    existing = URLMapping.objects.filter(long_url_hash=url_hash).first()
    if existing:
        return existing  # same long URL → return same short code

    short_code = generate_short_code()
    mapping = URLMapping.objects.create(
        short_code=short_code,
        long_url=long_url,
        long_url_hash=url_hash
    )
    return mapping


def get_long_url(short_code: str) -> str | None:
    cached = get_cached_url(short_code)
    if cached is not None:
        return cached

    # 2. DB miss path
    try:
        obj = URLMapping.objects.only("long_url", "click_count").get(short_code=short_code)
    except URLMapping.DoesNotExist:
        return None

    # 3. Populate cache — TTL based on click popularity
    ttl = REDIRECT_TTL if obj.click_count > 100 else COLD_TTL
    set_cached_url(short_code, obj.long_url, ttl=ttl)

    # 4. Async click increment (don't block redirect)
    URLMapping.objects.filter(short_code=short_code).update(click_count=F("click_count") + 1)

    return obj.long_url