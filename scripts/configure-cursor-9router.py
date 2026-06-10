#!/usr/bin/env python3
"""Point Cursor at local 9router and select the alfie combo model."""

from __future__ import annotations

import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

CURSOR_DB = Path.home() / "Library/Application Support/Cursor/User/globalStorage/state.vscdb"
ROUTER_DB = Path.home() / ".9router/db/data.sqlite"
BASE_URL = "http://localhost:20128/v1"
MODEL = "alfie"
APP_USER_KEY = (
    "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl"
    ".persistentStorage.applicationUser"
)
MODES = (
    "composer",
    "background-composer",
    "quick-agent",
    "plan-execution",
    "composer-ensemble",
    "cmd-k",
)


def router_key() -> str:
    conn = sqlite3.connect(ROUTER_DB)
    row = conn.execute("SELECT key FROM apiKeys WHERE isActive=1 LIMIT 1").fetchone()
    conn.close()
    if not row:
        raise SystemExit("No active 9router API key found. Create one in the dashboard.")
    return row[0]


def fix_combo() -> None:
    conn = sqlite3.connect(ROUTER_DB)
    row = conn.execute("SELECT models FROM combos WHERE name=?", (MODEL,)).fetchone()
    if not row:
        raise SystemExit(f"Combo '{MODEL}' not found in 9router.")
    models = json.loads(row[0])
    fixed = [m.replace("kr/MiniMax-M2.5", "kr/minimax-m2.5") for m in models]
    if models != fixed:
        conn.execute(
            "UPDATE combos SET models=?, updatedAt=? WHERE name=?",
            (json.dumps(fixed), datetime.now(timezone.utc).isoformat(), MODEL),
        )
        conn.commit()
        print(f"Fixed combo models: {fixed}")
    conn.close()


def configure_cursor() -> None:
    if not CURSOR_DB.exists():
        raise SystemExit(f"Cursor database not found: {CURSOR_DB}")

    backup = CURSOR_DB.with_name(
        CURSOR_DB.name + f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    )
    shutil.copy2(CURSOR_DB, backup)
    print(f"Backed up Cursor DB to {backup}")

    key = router_key()
    conn = sqlite3.connect(CURSOR_DB)
    row = conn.execute(
        "SELECT value FROM ItemTable WHERE key=?", (APP_USER_KEY,)
    ).fetchone()
    if not row:
        raise SystemExit("Cursor application settings key not found.")

    data = json.loads(row[0])
    data["openAIBaseUrl"] = BASE_URL
    data["useOpenAIKey"] = True

    ai = data.setdefault("aiSettings", {})
    model_config = ai.setdefault("modelConfig", {})
    for mode in MODES:
        model_config.setdefault(mode, {})["modelName"] = MODEL

    overrides = ai.setdefault("modelOverrideEnabled", [])
    for name in (MODEL,):
        if name not in overrides:
            overrides.append(name)

    data.setdefault("featureModelConfigs", {}).setdefault("composer", {})[
        "defaultModel"
    ] = MODEL

    conn.execute(
        "UPDATE ItemTable SET value=? WHERE key=?",
        (json.dumps(data, separators=(",", ":")), APP_USER_KEY),
    )
    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('cursorAuth/openAIKey', ?)",
        (key,),
    )
    conn.commit()
    conn.close()
    print(f"Cursor configured: base={BASE_URL}, model={MODEL}")


def main() -> None:
    fix_combo()
    configure_cursor()
    print("Done. Restart Cursor if it was open during this run.")


if __name__ == "__main__":
    main()
