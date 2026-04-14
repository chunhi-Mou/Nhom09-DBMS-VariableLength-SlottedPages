import argparse
import csv
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parents[2]
DATABASE_DIR = REPO_ROOT / "Database"
DATA_SPEC = {
    "students": {
        "path": DATABASE_DIR / "database-Student.txt",
        "columns": ["student_id", "full_name", "class_name", "email", "phone"],
    },
    "courses": {
        "path": DATABASE_DIR / "database-Course.txt",
        "columns": ["course_id", "course_name", "credits", "dept_name"],
    },
    "enrollments": {
        "path": DATABASE_DIR / "database-Enrollment.txt",
        "columns": ["student_id", "course_id", "semester", "score"],
    },
}


def _normalize_row(table_key, raw_row):
    columns = DATA_SPEC[table_key]["columns"]
    normalized = (raw_row + [""] * len(columns))[: len(columns)]
    return {column: normalized[idx].strip() for idx, column in enumerate(columns)}


def _read_table(table_key):
    spec = DATA_SPEC[table_key]
    file_path = spec["path"]
    rows = []
    if not file_path.exists():
        return rows

    with file_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for raw_row in reader:
            if not raw_row or all(not value.strip() for value in raw_row):
                continue
            rows.append(_normalize_row(table_key, raw_row))
    return rows


def _load_payload():
    payload = {}
    for table_key in DATA_SPEC:
        payload[table_key] = _read_table(table_key)
    return payload


def _normalize_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object.")

    normalized = {}
    for table_key, spec in DATA_SPEC.items():
        columns = spec["columns"]
        raw_rows = payload.get(table_key, [])
        if not isinstance(raw_rows, list):
            raise ValueError(f"Field '{table_key}' must be an array.")
        safe_rows = []
        for raw_row in raw_rows:
            if not isinstance(raw_row, dict):
                raise ValueError(f"Rows of '{table_key}' must be objects.")
            safe_rows.append({column: str(raw_row.get(column, "")).strip() for column in columns})
        normalized[table_key] = safe_rows
    return normalized


def _normalize_record(table_key, raw_record):
    if not isinstance(raw_record, dict):
        raise ValueError("'record' must be an object.")
    columns = DATA_SPEC[table_key]["columns"]
    return {column: str(raw_record.get(column, "")).strip() for column in columns}


def _parse_operation(payload):
    if isinstance(payload, dict) and "operation" in payload:
        payload = payload["operation"]
    if not isinstance(payload, dict):
        raise ValueError("Request body must contain an operation object.")

    table_key = payload.get("table")
    action = payload.get("action")
    if table_key not in DATA_SPEC:
        raise ValueError("Invalid or missing 'table'.")
    if action not in {"insert", "update", "delete"}:
        raise ValueError("Invalid or missing 'action'.")

    operation = {
        "table": table_key,
        "action": action,
    }

    if action in {"update", "delete"}:
        line = payload.get("line")
        if not isinstance(line, int) or line < 1:
            raise ValueError("'line' must be a positive integer for update/delete.")
        operation["line"] = line

    if action in {"insert", "update"}:
        operation["record"] = _normalize_record(table_key, payload.get("record"))

    return operation


def _write_table(table_key, rows):
    spec = DATA_SPEC[table_key]
    file_path = spec["path"]
    columns = spec["columns"]
    temp_path = file_path.with_suffix(file_path.suffix + ".tmp")
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with temp_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        for row in rows:
            writer.writerow([row.get(column, "") for column in columns])

    os.replace(temp_path, file_path)


def _count_table_rows(table_key):
    spec = DATA_SPEC[table_key]
    file_path = spec["path"]
    if not file_path.exists():
        return 0
    count = 0
    with file_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for raw_row in reader:
            if raw_row and any(value.strip() for value in raw_row):
                count += 1
    return count


def _append_row(table_key, row):
    spec = DATA_SPEC[table_key]
    file_path = spec["path"]
    columns = spec["columns"]
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with file_path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow([row.get(column, "") for column in columns])


def _rewrite_row_by_line(table_key, target_line, replacement_row=None):
    spec = DATA_SPEC[table_key]
    file_path = spec["path"]
    columns = spec["columns"]
    temp_path = file_path.with_suffix(file_path.suffix + ".tmp")

    if not file_path.exists():
        raise ValueError(f"File for table '{table_key}' does not exist.")

    found = False
    logical_line = 0
    with file_path.open("r", encoding="utf-8", newline="") as src, temp_path.open("w", encoding="utf-8", newline="") as dst:
        reader = csv.reader(src)
        writer = csv.writer(dst, lineterminator="\n")
        for raw_row in reader:
            if not raw_row or all(not value.strip() for value in raw_row):
                continue

            logical_line += 1
            if logical_line == target_line:
                found = True
                if replacement_row is None:
                    continue
                writer.writerow([replacement_row.get(column, "") for column in columns])
                continue

            normalized = _normalize_row(table_key, raw_row)
            writer.writerow([normalized.get(column, "") for column in columns])

    if not found:
        try:
            temp_path.unlink(missing_ok=True)
        except TypeError:
            if temp_path.exists():
                temp_path.unlink()
        raise ValueError(f"Line {target_line} not found in '{table_key}'.")

    os.replace(temp_path, file_path)


def _save_payload(payload):
    for table_key, rows in payload.items():
        _write_table(table_key, rows)


def _apply_operation(operation):
    table_key = operation["table"]
    action = operation["action"]
    if action == "insert":
        _append_row(table_key, operation["record"])
        return {
            "ok": True,
            "table": table_key,
            "action": action,
            "line": _count_table_rows(table_key),
        }

    if action == "update":
        _rewrite_row_by_line(table_key, operation["line"], operation["record"])
        return {
            "ok": True,
            "table": table_key,
            "action": action,
            "line": operation["line"],
        }

    _rewrite_row_by_line(table_key, operation["line"], None)
    return {
        "ok": True,
        "table": table_key,
        "action": action,
        "line": operation["line"],
    }


class DemoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/data":
            self._send_json(200, _load_payload())
            return
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/demo/web/index.html")
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in {"/api/data", "/api/data/op"}:
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            payload = json.loads(raw_body.decode("utf-8"))

            if path == "/api/data":
                normalized = _normalize_payload(payload)
                _save_payload(normalized)
                self._send_json(200, {"ok": True, "mode": "full-replace"})
                return

            operation = _parse_operation(payload)
            result = _apply_operation(operation)
            self._send_json(200, result)
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "Invalid JSON body"})
        except ValueError as error:
            self._send_json(400, {"ok": False, "error": str(error)})
        except Exception as error:  # pylint: disable=broad-except
            self._send_json(500, {"ok": False, "error": f"Internal server error: {error}"})


def main():
    parser = argparse.ArgumentParser(description="Serve slotted-page demo with txt persistence API")
    parser.add_argument("--port", type=int, default=5500, help="Port to run the server on (default: 5500)")
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), DemoHandler)
    print(f"Server running at http://127.0.0.1:{args.port}/demo/web/index.html")
    print("Preview API: GET http://127.0.0.1:{}/api/data".format(args.port))
    print("Persistence API: POST http://127.0.0.1:{}/api/data/op".format(args.port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
