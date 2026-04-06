from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from common import compact_page, delete_slot, seed_page
from json_helper import COMPACT_COMPLEXITY, DELETE_COMPLEXITY, log_focus, log_state, make_gap, make_state, write_demo_json

TITLE = "Demo 3 · Slot giữ, cell dữ liệu dời"
SUBTITLE = "Slot giữ nghĩa là ptr hoặc slot vẫn ở header. Record dời nghĩa là cell dữ liệu của record bị dời trong vùng dữ liệu."


def run_demo():
    page, slot_labels, _, inserted = seed_page()
    states = []

    delete_id = inserted[1][1]
    delete_label = slot_labels[delete_id]
    deleted_slot = page._read_slot(delete_id)
    gaps = make_gap(deleted_slot.offset, deleted_slot.length)

    print("DEMO 3: Slot giữ, cell dữ liệu dời")
    delete_ms = delete_slot(page, delete_id)
    before_compact = make_state(
        short="Mốc trước compact",
        title="Mốc trước compact",
        note=f"Đã xóa {delete_label}. Đây là mốc trước khi dời các cell dữ liệu.",
        operation=f"Xóa slot {delete_id}",
        timing_ms=delete_ms,
        complexity=DELETE_COMPLEXITY,
        page=page,
        slot_labels=slot_labels,
        gaps=gaps,
        slot_panel_title="Ptr/slot giữ trong header",
    )
    states.append(before_compact)
    print(f"Xóa {delete_label} ở slot {delete_id}")
    print(f"Thời gian: {before_compact['timing_text']} ({before_compact['complexity']})")
    log_state(before_compact)
    log_focus(before_compact)

    moved, compact_ms = compact_page(page)
    after_compact = make_state(
        short="Kết quả compact",
        title="Sau khi compact",
        note="Các ptr vẫn giữ nguyên trong header. cell3 và cell4 là hai cell dữ liệu bị dời để lấp vùng xóa.",
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

    target = write_demo_json("demo_slot_stability.json", TITLE, SUBTITLE, states)
    print(f"\nĐã ghi JSON: {target.name}")


if __name__ == "__main__":
    run_demo()
