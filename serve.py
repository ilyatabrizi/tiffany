#!/usr/bin/env python3
"""Local preview. python3 serve.py -> http://localhost:8131

Range support matters: the hero clip is served to a <video> element, and
Safari will not start a clip the server answers with a flat 200. """
import functools
import http.server
import os
import pathlib
import re
import socketserver

PORT = 8131
ROOT = pathlib.Path(__file__).resolve().parent


class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.webmanifest': 'application/manifest+json',
                      '.woff2': 'font/woff2', '.webp': 'image/webp',
                      '.mp4': 'video/mp4', '.js': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_head(self):
        rng = self.headers.get('Range')
        if not rng:
            return super().send_head()
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()
        m = re.match(r'bytes=(\d+)-(\d*)', rng)
        if not m:
            return super().send_head()
        size = os.path.getsize(path)
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416)
            return None
        f = open(path, 'rb')
        f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        return _Slice(f, end - start + 1)

    def log_message(self, *a):
        pass


class _Slice:
    """A file object that stops at the end of the requested range."""

    def __init__(self, f, length):
        self.f, self.left = f, length

    def read(self, n=-1):
        if self.left <= 0:
            return b''
        n = self.left if n < 0 else min(n, self.left)
        data = self.f.read(n)
        self.left -= len(data)
        return data

    def close(self):
        self.f.close()


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT),
                                functools.partial(H, directory=str(ROOT))) as httpd:
        print(f'TIFFANY  ->  http://localhost:{PORT}')
        httpd.serve_forever()
