from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from common import seed_page, Timer
from json_helper import DemoTracker, make_gap

TITLE = "Demo 3 · Slot giữ, cell dữ liệu dời"
SUBTITLE = "Slot giữ nghĩa là ptr hoặc slot vẫn ở header. Record dời nghĩa là cell dữ liệu của record bị dời trong vùng dữ liệu."

def capture_before_compact(tracker, page, slot_labels, delete_id, delete_label, timing_ms, gaps):
    tracker.capture(
        page, slot_labels,
        short="Mốc trước compact",
        title="Mốc trước compact",
        note=f"Đã xóa {delete_label}. Đây là mốc trước khi dời các cell dữ liệu.",
        operation=f"Xóa slot {delete_id}",
        timing_ms=timing_ms,
        complexity="O(1) (Cập nhật offset)",
        gaps=gaps,
        slot_panel_title="Ptr/slot giữ trong header",
    )

def capture_after_compact(tracker, page, slot_labels, timing_ms, moved):
    tracker.capture(
        page, slot_labels,
        short="Kết quả compact",
        title="Sau khi compact",
        note="Các ptr vẫn giữ nguyên trong header. cell3 và cell4 là hai cell dữ liệu bị dời để lấp vùng xóa.",
        operation="Compact page",
        timing_ms=timing_ms,
        complexity="O(P) (Dồn nén dữ liệu)",
        moved=moved,
        slot_panel_title="Ptr/slot giữ trong header",
    )

def run_demo():
    page, slot_labels, _, inserted = seed_page()
    tracker = DemoTracker("demo_slot_stability.json", TITLE, SUBTITLE)

    delete_id = inserted[1][1]
    delete_label = slot_labels[delete_id]
    deleted_slot = page._read_slot(delete_id)
    gaps = make_gap(deleted_slot.offset, deleted_slot.length)

    with Timer() as t1:
        page.delete(delete_id)

    capture_before_compact(tracker, page, slot_labels, delete_id, delete_label, t1.ms, gaps)

    with Timer() as t2:
        moved = page.compact()

    capture_after_compact(tracker, page, slot_labels, t2.ms, moved)

    tracker.save()

if __name__ == "__main__":
    run_demo()
