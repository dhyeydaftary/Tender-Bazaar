#!/usr/bin/env python3
"""Prove that the isolated local demo shares nothing with another TenderBazaar stack.

Usage:
    docker compose -p tenderbazaar-demo --env-file .env.demo.local \
        -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.demo-local.yml \
        config --format json > demo-local.json
    python3 scripts/check-demo-isolation.py demo-local.json [--busy-ports 3000,3001,4000]

--busy-ports lists host ports already bound on this machine (e.g. by the
existing stack); the demo must not publish any of them.

Checks, on the merged configuration the demo will actually run with:
  - project name is tenderbazaar-demo;
  - no service pins a container_name (pinned names are global, not per-project);
  - every volume and network is prefixed tenderbazaar-demo_;
  - every DATABASE_URL targets the tenderbazaar_demo database;
  - no service loads an env_file (the developer's .env must not leak in);
  - only web/admin/api-server/demo-gateway publish ports, all on 127.0.0.1, none busy;
  - the real scraper is absent.
"""

from __future__ import annotations

import json
import sys

PROJECT = "tenderbazaar-demo"
DEMO_DB = "tenderbazaar_demo"
# Services allowed to publish a host port at all — still 127.0.0.1-only and not
# busy. demo-gateway is the server demo's single entry point
# (docker-compose.demo-server.yml); the server overlay removes the other three.
MAY_PUBLISH = {"web", "admin", "api-server", "demo-gateway"}


def main(argv: list[str]) -> int:
    args = argv[1:]
    if not args:
        print(__doc__)
        return 2
    busy: set[str] = set()
    if "--busy-ports" in args:
        i = args.index("--busy-ports")
        busy = {p.strip() for p in args[i + 1].split(",") if p.strip()}
        del args[i : i + 2]

    with open(args[0], encoding="utf-8") as handle:
        config = json.load(handle)

    problems: list[str] = []
    if config.get("name") != PROJECT:
        problems.append(f"project name is {config.get('name')!r}, expected {PROJECT!r}")

    services = config.get("services") or {}
    if "scraper" in services:
        problems.append("the real `scraper` service is included")

    for name, svc in sorted(services.items()):
        if svc.get("container_name"):
            problems.append(f"{name}: pins container_name {svc['container_name']!r}")
        if svc.get("env_file"):
            problems.append(f"{name}: loads an env_file")
        url = (svc.get("environment") or {}).get("DATABASE_URL")
        if url is not None and not url.rstrip("/").endswith(f"/{DEMO_DB}"):
            problems.append(f"{name}: DATABASE_URL does not target {DEMO_DB}")
        for port in svc.get("ports") or []:
            published = str(port.get("published"))
            if name not in MAY_PUBLISH:
                problems.append(f"{name}: publishes host port {published}")
            if port.get("host_ip") != "127.0.0.1":
                problems.append(f"{name}: port {published} is not bound to 127.0.0.1")
            if published in busy:
                problems.append(f"{name}: host port {published} is already in use")

    for kind in ("volumes", "networks"):
        for key, spec in (config.get(kind) or {}).items():
            real = (spec or {}).get("name", "")
            if not real.startswith(f"{PROJECT}_"):
                problems.append(f"{kind[:-1]} {key!r} resolves to {real!r}, outside the demo project")

    if problems:
        print("FAIL: the demo is not isolated:")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print(f"OK: {PROJECT} is isolated ({len(services)} services).")
    for kind in ("volumes", "networks"):
        print(f"  {kind}: {', '.join(sorted(v['name'] for v in (config.get(kind) or {}).values()))}")
    published = [
        f"{n}={p['host_ip']}:{p['published']}" for n, s in sorted(services.items()) for p in s.get("ports") or []
    ]
    print(f"  published: {', '.join(published)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
