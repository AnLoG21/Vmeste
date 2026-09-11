"""Allow embedding public widgets (/w, /s, /m) in third-party iframes."""


class AllowWidgetIframeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path or ""
        embeddable = (
            path.startswith("/w/")
            or path.startswith("/s/")
            or path.startswith("/m/")
            or path.startswith("/api/booking/public/")
            or path.startswith("/api/shop/public/")
            or path.startswith("/api/cafe/m/")
            or path.startswith("/api/cafe/public/")
        )
        if embeddable:
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
