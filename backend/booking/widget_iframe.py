"""Allow embedding the public booking widget (/w/*) in third-party iframes."""


class AllowWidgetIframeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path or ""
        if path.startswith("/w/") or path.startswith("/api/booking/public/"):
            response.headers["X-Frame-Options"] = "ALLOWALL"
            # Chromium ignores ALLOWALL; remove header for true embed.
            try:
                del response.headers["X-Frame-Options"]
            except KeyError:
                pass
            # CSP frame-ancestors * for embed (if CSP set elsewhere, this supplements)
            csp = response.headers.get("Content-Security-Policy", "")
            if "frame-ancestors" not in csp:
                response.headers["Content-Security-Policy"] = (
                    (csp + "; " if csp else "") + "frame-ancestors *"
                ).strip("; ")
        return response
