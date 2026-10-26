#!/usr/bin/env python3
"""Assert that a demo Compose configuration cannot run the real scraper.

Usage:
    docker compose -f docker-compose.yml -f docker-compose.prod.yml \
                   -f docker-compose.demo.yml config --format json > demo.json
    python3 scripts/check-demo-compose.py demo.json [--server]

Accepts the JSON that `config --format json` prints (no third-party modules
needed) or YAML when PyYAML is installed.

Why a check rather than trusting the overlay: a Compose profile hides a service
only from commands that do not name it, and only while no profile selecting it
is active (`--profile`, COMPOSE_PROFILES). This verifies the merged result the
demo will actually run with:

  - `scraper` (the real, Playwright-based engine) is absent;
  - `demo-scraper` is present, built from Dockerfile.demo, in demo mode,
    and publishes no host ports;
  - api-server points at demo-scraper with the queue fallback disabled;
  - no service depends on `scraper`.

For the server deployment (docker-compose.demo-server.yml) it also verifies the
simulated checkout: api-server sets PAYMENTS_DEMO_MODE='true' and
DEMO_DEPLOYMENT='tenderbazaar-demo', with an empty RAZORPAY_KEY_ID and
RAZORPAY_KEY_SECRET (exactly "", not whitespace). These checks run when
--server is given, when `demo-gateway` is present, or when api-server runs a
`tenderbazaar-demo-server/` image — each of which only the server overlay
introduces — so a server configuration cannot skip them by renaming or
dropping the gateway, while the local demo is unaffected.
"""

from __future__ import annotations

import json
import sys


def load(path: str) -> dict:
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            import yaml  # type: ignore
        except ImportError:  # pragma: no cover
            sys.exit("Input is not JSON and PyYAML is not installed: use `config --format json`.")
        return yaml.safe_load(text)


def env_of(service: dict) -> dict:
    env = service.get("environment") or {}
    if isinstance(env, list):
        return dict(item.split("=", 1) if "=" in item else (item, "") for item in env)
    return env


DEMO_DEPLOYMENT_ID = "tenderbazaar-demo"
SERVER_IMAGE_PREFIX = "tenderbazaar-demo-server/"


def is_server_config(services: dict) -> bool:
    """Whether this merged configuration is the server demo deployment."""
    if "demo-gateway" in services:
        return True
    api = services.get("api-server") or {}
    return str(api.get("image") or "").startswith(SERVER_IMAGE_PREFIX)


def payment_problems(api_env: dict) -> list[str]:
    """The server demo must use simulated checkout and hold no Razorpay keys.

    Values are never printed: only whether each is set as required.
    """
    problems: list[str] = []
    if api_env.get("PAYMENTS_DEMO_MODE") != "true":
        problems.append("api-server PAYMENTS_DEMO_MODE is not 'true'")
    if api_env.get("DEMO_DEPLOYMENT") != DEMO_DEPLOYMENT_ID:
        problems.append(f"api-server DEMO_DEPLOYMENT is not {DEMO_DEPLOYMENT_ID!r}")
    for name in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"):
        if name not in api_env:
            problems.append(f"api-server does not set {name} explicitly (it must be empty)")
        elif api_env[name] != "":
            # Exactly empty: a whitespace-only value is not "unset" to every
            # consumer of the variable.
            problems.append(f"api-server {name} is not exactly empty")
    return problems


def main(argv: list[str]) -> int:
    args = argv[1:]
    server = "--server" in args
    args = [arg for arg in args if arg != "--server"]
    if len(args) != 1:
        print(__doc__)
        return 2

    services = load(args[0]).get("services") or {}
    server = server or is_server_config(services)
    problems: list[str] = []

    if "scraper" in services:
        problems.append("the real `scraper` service is part of the configuration")

    demo = services.get("demo-scraper")
    if demo is None:
        problems.append("`demo-scraper` is missing")
    else:
        dockerfile = (demo.get("build") or {}).get("dockerfile", "")
        if not dockerfile.endswith("Dockerfile.demo"):
            problems.append(f"`demo-scraper` builds from {dockerfile!r}, not Dockerfile.demo")
        if env_of(demo).get("DEMO_SCRAPER_MODE") != "true":
            problems.append("`demo-scraper` does not set DEMO_SCRAPER_MODE=true")
        if demo.get("ports"):
            problems.append("`demo-scraper` publishes host ports")

    api = services.get("api-server")
    if api is None:
        problems.append("`api-server` is missing")
    else:
        api_env = env_of(api)
        if api_env.get("SCRAPER_API_URL") != "http://demo-scraper:4001":
            problems.append(f"api-server SCRAPER_API_URL is {api_env.get('SCRAPER_API_URL')!r}")
        if api_env.get("SCRAPER_QUEUE_FALLBACK") != "false":
            problems.append("api-server SCRAPER_QUEUE_FALLBACK is not 'false'")
        if server:
            problems.extend(payment_problems(api_env))

    for name, service in services.items():
        if "scraper" in (service.get("depends_on") or {}):
            problems.append(f"`{name}` depends on the real scraper")

    if problems:
        print("FAIL: the demo configuration is not safe to run:")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print("OK: demo configuration excludes the real scraper.")
    if server:
        print("OK: server demo uses simulated payments with no Razorpay keys.")
    print(f"  services: {', '.join(sorted(services))}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
