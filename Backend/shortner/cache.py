from django.core.cache import cache
import logging

logger= logging.getLogger(__name__)

REDIRECT_TTL = 60 * 60 * 24
COLD_TTL = 60 * 60 * 2
KEY_PREFIX = "url:"

def get_cached_url(short_code : str) -> str | None :
    return cache.get(KEY_PREFIX+short_code)

def set_cached_url(short_code:  str, long_url:str, ttl: int=REDIRECT_TTL) -> None:
    cache.set(KEY_PREFIX+short_code, long_url, timeout=ttl)
    
def invalidate_url(short_code: str) -> None: 
    cache.delete(KEY_PREFIX+short_code)

def bulk_warm_cache(mappings : list[tuple[str, str]]) -> None:
    cache.set_many(
        {KEY_PREFIX + code: url for code, url in mappings},
        timeout=REDIRECT_TTL,
    )