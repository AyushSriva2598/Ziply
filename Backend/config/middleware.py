from django.http import JsonResponse
from shortner.ratelimit import is_rate_limited

class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", ""))
        ip = ip.split(",")[0].strip()

        if is_rate_limited(ip):
            return JsonResponse({"error": "Rate limit exceeded. Try again later."}, status=429)

        return self.get_response(request)