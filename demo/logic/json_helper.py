from pathlib import Path
import json

from common import format_ms, shorten

DEMO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = DEMO_ROOT / "data"
INSERT_COMPLEXITY = "O(n) tệ nhất"
DELETE_COMPLEXITY = "O(1)"
COMPACT_COMPLEXITY = "O(n log n)"


def ptr_name(slot_id: int) -> str:
    return f"ptr{slot_id + 1}"


def cell_name(slot_id: int) -> str:
    return f"cell{slot_id + 1}"


def make_gap(start: int, length: int, label: str = "vùng\nxóa") -> list[dict]:
    if length <= 0:
        return []
    return [{"start": start, "length": length, "label": label}]


def snapshot_page(page, slot_labels: dict, gaps: list | None = None) -> dict:
    header = page._read_header()
    slots = []

    for slot_id in range(header.num_entries):
        slot = page._read_slot(slot_id)
        item = {
            "id": slot_id,
            "ptr": ptr_name(slot_id),
            "cell": cell_name(slot_id),
            "label": slot_labels.get(slot_id, ""),
            "status": "empty" if slot.is_empty else "active",
        }
        if not slot.is_empty:
            item["offset"] = slot.offset
            item["length"] = slot.length
            item["data"] = shorten(page.get(slot_id).decode("utf-8"), 54)
        slots.append(item)

    return {
        "page_size": page.page_size,
        "header_size": header.header_size,
        "free_start": header.header_size,
        "free_end": header.free_space_ptr,
        "free_bytes": page.free_space(),
        "slots": slots,
        "gaps": gaps or [],
    }


def build_slot_summary(page, slot_labels: dict) -> list[dict]:
    header = page._read_header()
    summary = []

    for slot_id in range(header.num_entries):
        slot = page._read_slot(slot_id)
        item = {
            "slot_id": slot_id,
            "ptr": ptr_name(slot_id),
            "slot_kept": True,
            "status": "empty" if slot.is_empty else "active",
        }
        if not slot.is_empty:
            item["cell"] = cell_name(slot_id)
            item["label"] = slot_labels.get(slot_id, "")
            item["offset"] = slot.offset
            item["length"] = slot.length
        summary.append(item)

    return summary


def build_move_summary(page, slot_labels: dict, moved: dict | None = None) -> list[dict]:
    if not moved:
        return []

    summary = []
    for slot_id in sorted(moved):
        old_offset, new_offset = moved[slot_id]
        slot = page._read_slot(slot_id)
        summary.append(
            {
                "slot_id": slot_id,
                "ptr": ptr_name(slot_id),
                "cell": cell_name(slot_id),
                "label": slot_labels.get(slot_id, ""),
                "from": old_offset,
                "to": new_offset,
                "length": slot.length,
            }
        )
    return summary


def make_state(
    *,
    short: str,
    title: str,
    note: str,
    operation: str,
    timing_ms: float,
    complexity: str,
    page,
    slot_labels: dict,
    gaps: list | None = None,
    moved: dict | None = None,
    slot_panel_title: str | None = None,
) -> dict:
    move_summary = build_move_summary(page, slot_labels, moved)
    return {
        "short": short,
        "title": title,
        "note": note,
        "operation": operation,
        "timing_ms": round(timing_ms, 3),
        "timing_text": format_ms(timing_ms),
        "complexity": complexity,
        "slot_panel_title": slot_panel_title or ("Ptr/slot giữ trong header" if move_summary else "Ptr/slot trong header"),
        "move_panel_title": "Cell dữ liệu bị dời",
        "page": snapshot_page(page, slot_labels, gaps),
        "stable_slots": build_slot_summary(page, slot_labels),
        "moved_records": move_summary,
    }


def write_demo_json(file_name: str, title: str, subtitle: str, states: list[dict]) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    target = DATA_DIR / file_name
    payload = {
        "title": title,
        "subtitle": subtitle,
        "states": states,
    }
    target.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return target


def log_state(state: dict):
    page = state["page"]
    print(f"\n[{state['title']}]")
    print(state["note"])
    print(
        f"Header={page['header_size']}B, free_start={page['free_start']}, "
        f"free_end={page['free_end']}, free={page['free_bytes']}B"
    )

    if not page["slots"]:
        print("Page rỗng.")
        return

    for slot in page["slots"]:
        if slot["status"] == "empty":
            print(f"{slot['ptr']}: rỗng")
            continue
        print(
            f"{slot['ptr']} -> {slot['cell']}, {slot['label']}, "
            f"off={slot['offset']}, len={slot['length']}"
        )

    for gap in page["gaps"]:
        label = str(gap["label"]).replace("\n", " ")
        print(f"{label}: start={gap['start']}, len={gap['length']}")


def log_focus(state: dict):
    print("\nPtr/slot giữ trong header")
    for item in state["stable_slots"]:
        if item["status"] == "empty":
            print(f"{item['ptr']}: vẫn giữ chỗ trong header, hiện là slot rỗng")
            continue
        print(
            f"{item['ptr']}: vẫn ở header, trỏ tới {item['cell']} của {item['label']}"
        )

    if not state["moved_records"]:
        return

    print("\nCell dữ liệu bị dời")
    for item in state["moved_records"]:
        print(
            f"{item['cell']}: dữ liệu của {item['label']} dời {item['from']} -> {item['to']}, "
            f"còn {item['ptr']} vẫn giữ nguyên"
        )


def log_payload(label: str, raw_text: str, size: int):
    print(f"\n{label}: {size}B")
    print(f"Dữ liệu: {shorten(raw_text)}")
