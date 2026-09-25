#!/usr/bin/env python3
"""Validate UAT test-case files against the schema and library-wide rules.

Usage:
    python references/validate.py [test_cases_dir]

Defaults to ./test_cases relative to the current directory.
Checks, per file: JSON parses, conforms to case.schema.json, and every case's
feature_area matches the file's. Across files: TC-XXX ids are globally unique.
Exits non-zero on any failure.

Requires: jsonschema  (pip install jsonschema)
"""
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft7Validator
except ImportError:
    sys.exit("Missing dependency: pip install jsonschema")

HERE = Path(__file__).resolve().parent
SCHEMA = json.loads((HERE / "case.schema.json").read_text())


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("test_cases")
    if not root.is_dir():
        return _fail(f"Directory not found: {root}")

    validator = Draft7Validator(SCHEMA)
    errors: list[str] = []
    seen_ids: dict[str, str] = {}  # id -> file that first defined it

    files = sorted(root.glob("*.json"))
    if not files:
        return _fail(f"No .json files in {root}")

    for path in files:
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{path.name}: invalid JSON — {e}")
            continue

        for err in sorted(validator.iter_errors(data), key=lambda e: e.path):
            loc = "/".join(str(p) for p in err.path) or "(root)"
            errors.append(f"{path.name}: {loc}: {err.message}")

        file_area = data.get("feature_area")
        for case in data.get("test_cases", []):
            cid = case.get("id")
            if cid in seen_ids:
                errors.append(
                    f"{path.name}: duplicate id {cid} (also in {seen_ids[cid]})"
                )
            elif cid:
                seen_ids[cid] = path.name
            if file_area and case.get("feature_area") not in (None, file_area):
                errors.append(
                    f"{path.name}: {cid}: feature_area "
                    f"'{case.get('feature_area')}' != file area '{file_area}'"
                )

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return _fail(f"{len(errors)} problem(s) across {len(files)} file(s)")

    print(f"OK — {len(files)} file(s), {len(seen_ids)} unique case id(s)")
    return 0


def _fail(msg: str) -> int:
    print(f"FAIL: {msg}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
