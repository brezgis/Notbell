#!/usr/bin/env python3
"""Static server for Notbell Isle with no-cache headers, so every refresh
gets today's archipelago. Usage: python3 serve.py [port]"""
import http.server, sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
http.server.ThreadingHTTPServer(('0.0.0.0', port), NoCacheHandler).serve_forever()
