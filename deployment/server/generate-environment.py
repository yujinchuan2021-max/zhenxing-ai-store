#!/usr/bin/env python3
"""Create the server-only environment file without printing secrets."""

import os
import secrets
import sys
from pathlib import Path


SECRET_KEYS = {
    "AIHUB_IDENTITY_DB_PASSWORD",
    "AIHUB_FORUM_DB_PASSWORD",
    "AIHUB_FORUM_DB_ROOT_PASSWORD",
    "AIHUB_FORUM_ADMIN_PASSWORD",
    "AIHUB_FORUM_API_KEY",
    "AIHUB_FORUM_PASSWORD_TOKEN",
    "AIHUB_COMMUNITY_INTERNAL_SECRET",
}


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: generate-environment.py TEMPLATE OUTPUT")
    template = Path(sys.argv[1])
    output = Path(sys.argv[2])
    if output.exists():
        raise SystemExit(f"refusing to overwrite {output}")

    lines = []
    for line in template.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key in SECRET_KEYS:
            value = secrets.token_urlsafe(36)
        lines.append(f"{key}{separator}{value}")

    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(lines) + "\n")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

