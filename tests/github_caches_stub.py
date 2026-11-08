"""Stub of GitHub's `DELETE /repos/{repo}/actions/caches?key=` (2026-11-07, CMY-97).

Used by tests/drop-cache-entry.integration.test.sh. It answers like GitHub only when the
request is right (method, path, bearer token, one `key` query value); anything else gets
HTTP 400, which the script reports as a warning and the test catches.

The status comes from the key: everything after its last "~" (e.g. "a b&c~404" -> 404).
Each decoded key is appended to the log file so the test can check URL-encoding.

Usage: python3 -I github_caches_stub.py <port-file> <log-file> <repo> <token>
Binds 127.0.0.1 on a free port and writes that port to <port-file>.
"""

from __future__ import annotations

import http.server
import sys
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit


@dataclass(frozen=True)
class StubConfig:
    """What a correct request must carry, and where to log the keys it got."""

    log_file: str
    path: str
    auth: str


def make_handler(cfg: StubConfig) -> type[http.server.BaseHTTPRequestHandler]:
    """Builds the request handler bound to one StubConfig."""

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_DELETE(self) -> None:  # noqa: N802 (http.server naming)
            url = urlsplit(self.path)
            keys = parse_qs(url.query, keep_blank_values=True).get("key", [])
            ok = (
                url.path == cfg.path
                and self.headers.get("Authorization") == cfg.auth
                and len(keys) == 1
                and "~" in keys[0]
            )
            if not ok:
                self._reply(400)
                return
            with open(cfg.log_file, "a", encoding="utf-8") as log:
                log.write(keys[0] + "\n")
            self._reply(int(keys[0].rsplit("~", 1)[1]))

        def do_GET(self) -> None:  # noqa: N802 - wrong method must not pass
            self._reply(405)

        def _reply(self, status: int) -> None:
            self.send_response(status)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def log_message(self, *_: object) -> None:
            pass  # keep test output clean

    return Handler


def main(argv: list[str]) -> None:
    if len(argv) != 5:
        raise SystemExit(__doc__)
    port_file, log_file, repo, token = argv[1:]
    cfg = StubConfig(log_file, f"/repos/{repo}/actions/caches", f"Bearer {token}")
    server = http.server.HTTPServer(("127.0.0.1", 0), make_handler(cfg))
    with open(port_file, "w", encoding="utf-8") as f:
        f.write(str(server.server_address[1]))
    server.serve_forever()


if __name__ == "__main__":
    main(sys.argv)
