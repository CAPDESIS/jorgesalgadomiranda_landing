#!/usr/bin/env python3
"""Write api/secrets.php from RESEND_*/SMTP_* environment variables at deploy time."""

from __future__ import annotations

import os
import pathlib
import pprint


def main() -> None:
    secrets: dict[str, str] = {}
    for key in (
        "RESEND_API_KEY",
        "RESEND_FROM",
        "RESEND_TO",
        "RESEND_REPLY_TO",
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASS",
        "SMTP_FROM",
    ):
        val = os.environ.get(key, "").strip()
        if val:
            secrets[key] = val

    if "RESEND_FROM" not in secrets and secrets.get("RESEND_API_KEY"):
        secrets["RESEND_FROM"] = (
            "Jorge Salgado Miranda <noreply@jorgesalgadomiranda.com>"
        )
    if "RESEND_TO" not in secrets:
        secrets["RESEND_TO"] = "jorgesalgadomiranda@protonmail.com"

    body = (
        "<?php\n// Generated at deploy — do not commit.\nreturn "
        + pprint.pformat(secrets, width=100)
        + ";\n"
    )
    pathlib.Path("api/secrets.php").write_text(body)
    print("Wrote api/secrets.php with keys:", ", ".join(sorted(secrets)))


if __name__ == "__main__":
    main()
