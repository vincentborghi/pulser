# Development HTTP server for GroovePulse PWA
#
# Examples of command invocations:
#   python serve.py
#   python serve.py --port 8080
#   python serve.py --port 8000 --bind 0.0.0.0 --debug
#   python serve.py --help

import argparse
import functools
import http.server
import logging
import os
import sys

def configure_logging(debug_mode):
    log_level = logging.DEBUG if debug_mode else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S"
    )

def build_argument_parser():
    examples_text = """
Examples:
  python serve.py
  python serve.py --port 8080
  python serve.py --bind 0.0.0.0 --port 8000
  python serve.py --debug
    """
    parser = argparse.ArgumentParser(
        description="Serve GroovePulse PWA locally with proper MIME types for testing.",
        epilog=examples_text,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "-p", "--port",
        type=int,
        default=8000,
        help="Port to listen on (default: 8000)"
    )
    parser.add_argument(
        "-b", "--bind",
        type=str,
        default="127.0.0.1",
        help="IP address to bind to (default: 127.0.0.1; use 0.0.0.0 to allow mobile phone testing on LAN)"
    )
    parser.add_argument(
        "-d", "--directory",
        type=str,
        default=".",
        help="Root directory to serve static files from (default: current directory)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable verbose debug logging"
    )
    return parser

def run_server(bind_ip, port_num, directory_path, debug_mode):
    configure_logging(debug_mode)

    abs_dir = os.path.abspath(directory_path)
    if not os.path.isdir(abs_dir):
        logging.error("Target directory does not exist: %s", abs_dir)
        sys.exit(1)

    logging.debug("Serving static files from directory: %s", abs_dir)
    logging.debug("Configuring HTTP request handler with directory binding")

    handler_factory = functools.partial(
        http.server.SimpleHTTPRequestHandler,
        directory=abs_dir
    )

    logging.info("Starting local PWA web server...")
    logging.info("URL: http://%s:%d", bind_ip, port_num)
    if bind_ip == "0.0.0.0":
        logging.info("Tip: You can access this from your smartphone browser using your PC LAN IP!")
    logging.info("Press Ctrl+C to stop.")

    try:
        http.server.test(
            HandlerClass=handler_factory,
            ServerClass=http.server.ThreadingHTTPServer,
            port=port_num,
            bind=bind_ip
        )
    except KeyboardInterrupt:
        logging.info("Server stopped by user.")
    except Exception as err:
        logging.error("Fatal error running server: %s", err)
        sys.exit(1)

def execute_cli():
    parser = build_argument_parser()
    args = parser.parse_args()
    run_server(args.bind, args.port, args.directory, args.debug)

if __name__ == "__main__":
    execute_cli()
