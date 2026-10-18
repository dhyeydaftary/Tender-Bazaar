#!/usr/bin/env python3
"""Assert that the production Compose configuration publishes no internal ports.

Usage:
    docker compose -f docker-compose.yml -f docker-compose.prod.yml config > prod.yml
    python3 scripts/check-prod-ports.py prod.yml

Why this is a check rather than a convention: `ports: []` in an override file
does NOT clear a list inherited from the base file — Compose merges list
fields, so the empty list is a no-op. The production override used to rely on
exactly that, and silently kept postgres:5432, redis:6379,
elasticsearch:9200/9300, ai-service:5050 and the unauthenticated scraper
control API on 4001 published to the host. Port publishing now lives only in
docker-compose.override.yml (development), and this script keeps it that way.
"""

from __future__ import annotations

import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("PyYAML is required: pip install pyyaml")

# Services that must never be reachable from outside the Compose network.
MUST_BE_INTERNAL = [
    "postgres",
    "redis",
    "elasticsearch",
    "scraper",
    "ai-service",
    "db-init",
    "notification-service",
]


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2

    with open(argv[1], encoding="utf-8") as handle:
        spec = yaml.safe_load(handle)

    services = spec.get("services") or {}
    published: dict[str, list[object]] = {}
    for name, service in services.items():
        ports = service.get("ports") or []
        values = [p.get("published") if isinstance(p, dict) else p for p in ports]
        if values:
            published[name] = values

    offenders = {n: p for n, p in published.items() if n in MUST_BE_INTERNAL}
    if offenders:
        print("FAIL: these services publish host ports in the production configuration:")
        for name, ports in sorted(offenders.items()):
            print(f"  - {name}: {ports}")
        print()
        print("Port publishing belongs in docker-compose.override.yml (development only).")
        print("An empty `ports: []` in docker-compose.prod.yml does NOT clear an")
        print("inherited list; remove the ports from docker-compose.yml instead.")
        return 1

    print("OK: no infrastructure or scraper ports are published in production.")
    for name, ports in sorted(published.items()):
        print(f"  public: {name} -> {ports}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
