from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from common import seed_page, Timer
from json_helper import DemoTracker, make_gap

TITLE = "Demo 2 · Xóa rồi compact"
SUBTITLE = "Xóa một record, rồi dời các cell dữ liệu còn sống để lấp vùng xóa."

def capture_before_delete(tracker, page, slot_labels):
    tracker.capture(
        page, slot_labels,
        short="Trước khi xóa",
        title="Trước khi xóa",
        note="Page đang có 4 ptr trong header và 4 cell dữ liệu.",
        operation="Page đã nạp 4 record",
        complexity="O(1)",
    )

def capture_after_delete(tracker, page, slot_labels, delete_id, delete_label, timing_ms, gaps):
    tracker.capture(
        page, slot_labels,
        short="Sau khi xóa",
        title=f"Sau khi xóa {delete_label}",
        note=f"ptr{delete_id + 1} trong header vẫn còn, nhưng hiện là slot rỗng. Vùng xóa vẫn còn trong vùng dữ liệu.",
        operation=f"Xóa slot {delete_id}",
        timing_ms=timing_ms,
        complexity="O(1)",
        gaps=gaps,
    )

def capture_after_compact(tracker, page, slot_labels, timing_ms, moved):
    tracker.capture(
        page, slot_labels,
        short="Sau compact",
        title="Sau khi compact",
        note="Các ptr vẫn giữ nguyên trong header. Chỉ các cell dữ liệu còn sống bị dời để lấp vùng xóa.",
        operation="Compact page",
        timing_ms=timing_ms,
        complexity="O(P) (Dồn nén dữ liệu)",
        moved=moved,
        slot_panel_title="Ptr/slot giữ trong header",
    )

def run_demo():
    page, slot_labels, _, inserted = seed_page()
    tracker = DemoTracker("demo_delete_compact.json", TITLE, SUBTITLE)

    delete_id = inserted[1][1]
    delete_label = slot_labels[delete_id]
    deleted_slot = page._read_slot(delete_id)
    gaps = make_gap(deleted_slot.offset, deleted_slot.length)

    capture_before_delete(tracker, page, slot_labels)

    with Timer() as t1:
        page.delete(delete_id)

    capture_after_delete(tracker, page, slot_labels, delete_id, delete_label, t1.ms, gaps)

    with Timer() as t2:
        moved = page.compact()

    capture_after_compact(tracker, page, slot_labels, t2.ms, moved)

    tracker.save()

if __name__ == "__main__":
    run_demo()
