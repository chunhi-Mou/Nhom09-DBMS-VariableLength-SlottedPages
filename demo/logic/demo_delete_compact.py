from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from common import compact_page, delete_slot, seed_page
from json_helper import COMPACT_COMPLEXITY, DELETE_COMPLEXITY, log_focus, log_state, make_gap, make_state, write_demo_json

TITLE = "Demo 2 · Xóa rồi compact"
SUBTITLE = "Xóa một record, rồi dời các cell dữ liệu còn sống để lấp vùng xóa."


def run_demo():
    page, slot_labels, _, inserted = seed_page()
    states = []

    delete_id = inserted[1][1]
    delete_label = slot_labels[delete_id]
    deleted_slot = page._read_slot(delete_id)
    gaps = make_gap(deleted_slot.offset, deleted_slot.length)

    print("DEMO 2: Xóa một record rồi compact page")
    before_state = make_state(
        short="Trước khi xóa",
        title="Trước khi xóa",
        note="Page đang có 4 ptr trong header và 4 cell dữ liệu.",
        operation="Page đã nạp 4 record",
        timing_ms=0.0,
        complexity="O(1)",
        page=page,
        slot_labels=slot_labels,
    )
    states.append(before_state)
    log_state(before_state)

    delete_ms = delete_slot(page, delete_id)
    after_delete = make_state(
        short="Sau khi xóa",
        title=f"Sau khi xóa {delete_label}",
        note=f"ptr{delete_id + 1} trong header vẫn còn, nhưng hiện là slot rỗng. Vùng xóa vẫn còn trong vùng dữ liệu.",
        operation=f"Xóa slot {delete_id}",
        timing_ms=delete_ms,
        complexity=DELETE_COMPLEXITY,
        page=page,
        slot_labels=slot_labels,
        gaps=gaps,
    )
    states.append(after_delete)
    print(f"\nĐã xóa {delete_label} ở slot {delete_id}")
    print(f"Thời gian: {after_delete['timing_text']} ({after_delete['complexity']})")
    log_state(after_delete)

    moved, compact_ms = compact_page(page)
    after_compact = make_state(
        short="Sau compact",
        title="Sau khi compact",
        note="Các ptr vẫn giữ nguyên trong header. Chỉ các cell dữ liệu còn sống bị dời để lấp vùng xóa.",
        operation="Compact page",
        timing_ms=compact_ms,
        complexity=COMPACT_COMPLEXITY,
        page=page,
        slot_labels=slot_labels,
        moved=moved,
        slot_panel_title="Ptr/slot giữ trong header",
    )
    states.append(after_compact)
    print("\nĐã compact page")
    print(f"Thời gian: {after_compact['timing_text']} ({after_compact['complexity']})")
    log_state(after_compact)
    log_focus(after_compact)

    target = write_demo_json("demo_delete_compact.json", TITLE, SUBTITLE, states)
    print(f"\nĐã ghi JSON: {target.name}")


if __name__ == "__main__":
    run_demo()
