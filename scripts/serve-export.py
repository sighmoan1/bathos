"""Serve the static export for browser release checks."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class ExportServer(ThreadingHTTPServer):
    # Browser chunks and service-worker precaching arrive in bursts.
    request_queue_size = 128


class ExportHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        # Undrained request logs can fill a pipe and stall the release checks.
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=3021)
    args = parser.parse_args()
    with ExportServer(("127.0.0.1", args.port), partial(ExportHandler, directory="out")) as server:
        print(f"Serving this worktree's out/ at http://127.0.0.1:{args.port}", flush=True)
        server.serve_forever()
