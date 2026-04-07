from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from common import SlottedPage, build_demo_records, encode_record, Timer
from json_helper import DemoTracker, log_payload

TITLE = "Demo 1 · Chèn record khác độ dài"
SUBTITLE = "Mỗi lần chèn tạo thêm ptr trong header và cell trong vùng dữ liệu."

def capture_initial_state(tracker, page, slot_labels):
    tracker.capture(
        page, slot_labels,
        short="Page rỗng",
        title="Trước khi chèn",
        note="Page rỗng, chưa có ptr trong header và chưa có cell dữ liệu.",
        operation="Khởi tạo page",
        timing_ms=0.0,
        complexity="O(1)",
    )

def capture_insert_state(tracker, page, slot_labels, seed, slot_id, timing_ms):
    tracker.capture(
        page, slot_labels,
        short=f"Chèn {seed.label}",
        title=f"Sau khi chèn {seed.label}",
        note=f"ptr{slot_id + 1} trong header trỏ tới cell{slot_id + 1} của {seed.label}.",
        operation=f"Chèn {seed.label}",
        timing_ms=timing_ms,
        complexity="O(N) (Ghi vào khoảng trống)",
    )

def run_demo():
    records = build_demo_records()
    page = SlottedPage(page_size=256)
    slot_labels = {}
    tracker = DemoTracker("demo_insert.json", TITLE, SUBTITLE)

    capture_initial_state(tracker, page, slot_labels)

    for key in ["course_a", "enrollment_a", "student_a", "student_b"]:
        seed = records[key]
        log_payload(seed.label, seed.raw_text, seed.size)
        
        with Timer() as t:
            slot_id = page.insert(encode_record(seed.fields))
        
        slot_labels[slot_id] = seed.label
        capture_insert_state(tracker, page, slot_labels, seed, slot_id, t.ms)

    tracker.save()

if __name__ == "__main__":
    run_demo()
