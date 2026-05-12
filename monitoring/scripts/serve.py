#!/usr/bin/env python3
"""I2 monitoring — local HTTP server.

Serves the static monitoring/ directory and provides /api/refresh which
re-runs collect.py to regenerate aggregate.json. No external dependencies.
"""

from __future__ import annotations

import argparse
import http.server
import json
import socketserver
import subprocess
import sys
from pathlib import Path

MONITORING_DIR = Path(__file__).resolve().parent.parent
COLLECT_SCRIPT = Path(__file__).resolve().parent / "collect.py"


class MonitoringHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(MONITORING_DIR), **kwargs)

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/api/refresh":
            try:
                result = subprocess.run(
                    [sys.executable, str(COLLECT_SCRIPT)],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                ok = result.returncode == 0
                body = json.dumps(
                    {
                        "ok": ok,
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                        "returncode": result.returncode,
                    }
                ).encode("utf-8")
                self.send_response(200 if ok else 500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except subprocess.TimeoutExpired:
                self.send_error(504, "collect.py timeout")
            except Exception as e:  # pylint: disable=broad-except
                self.send_error(500, f"refresh failed: {e}")
            return
        self.send_error(404)

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        sys.stderr.write(f"[serve] {self.address_string()} {format % args}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="I2 monitoring local server")
    parser.add_argument("--port", type=int, default=7777, help="port (default 7777)")
    parser.add_argument("--bind", default="127.0.0.1", help="bind address (default 127.0.0.1 — do NOT use 0.0.0.0 unless intentional)")
    args = parser.parse_args()

    # Generate initial aggregate.json if missing.
    aggregate = MONITORING_DIR / "data" / "aggregate.json"
    if not aggregate.exists():
        print(f"[serve] no aggregate.json; running collect.py first", file=sys.stderr)
        subprocess.run([sys.executable, str(COLLECT_SCRIPT)], check=False)

    with socketserver.TCPServer((args.bind, args.port), MonitoringHandler) as httpd:
        print(f"[serve] listening on http://{args.bind}:{args.port}", file=sys.stderr)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[serve] stopped", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
