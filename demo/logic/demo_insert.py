from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from common import SlottedPage, build_demo_records, insert_seed
from json_helper import INSERT_COMPLEXITY, cell_name, log_payload, log_state, make_state, ptr_name, write_demo_json

TITLE = "Demo 1 · Chèn record khác độ dài"
SUBTITLE = "Mỗi lần chèn tạo thêm ptr trong header và cell trong vùng dữ liệu."


def run_demo():
    records = build_demo_records()
    page = SlottedPage(page_size=256)
    slot_labels = {}
    states = []

    print("DEMO 1: Chèn record có độ dài khác nhau")
    first_state = make_state(
        short="Page rỗng",
        title="Trước khi chèn",
        note="Page rỗng, chưa có ptr trong header và chưa có cell dữ liệu.",
        operation="Khởi tạo page",
        timing_ms=0.0,
        complexity="O(1)",
        page=page,
        slot_labels=slot_labels,
    )
    states.append(first_state)
    log_state(first_state)

    for key in ["course_a", "enrollment_a", "student_a", "student_b"]:
        seed = records[key]
        log_payload(seed.label, seed.raw_text, seed.size)
        slot_id, elapsed_ms = insert_seed(page, slot_labels, seed)
        state = make_state(
            short=f"Chèn {seed.label}",
            title=f"Sau khi chèn {seed.label}",
            note=f"{ptr_name(slot_id)} trong header trỏ tới {cell_name(slot_id)} của {seed.label}.",
            operation=f"Chèn {seed.label}",
            timing_ms=elapsed_ms,
            complexity=INSERT_COMPLEXITY,
            page=page,
            slot_labels=slot_labels,
        )
        states.append(state)
        print(f"\nĐã chèn {seed.label} vào slot {slot_id}")
        print(f"Thời gian: {state['timing_text']} ({state['complexity']})")
        log_state(state)

    target = write_demo_json("demo_insert.json", TITLE, SUBTITLE, states)
    print(f"\nĐã ghi JSON: {target.name}")


if __name__ == "__main__":
    run_demo()
