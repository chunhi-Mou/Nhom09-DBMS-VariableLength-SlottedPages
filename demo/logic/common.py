from dataclasses import dataclass
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from time import perf_counter
import sys

from models import Course, Enrollment, Student

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "src"


@dataclass(frozen=True)
class RecordSeed:
    key: str
    label: str
    raw_text: str
    fields: list

    @property
    def size(self) -> int:
        return len(encode_record(self.fields))


def _load_module(module_name: str, file_name: str):
    file_path = SRC_DIR / file_name
    spec = spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Không nạp được {file_path}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


RECORD_MODULE = _load_module("record_module", "2-record.py")
PAGE_MODULE = _load_module("page_module", "3-page.py")
encode_record = RECORD_MODULE.encode_record
SlottedPage = PAGE_MODULE.SlottedPage


def read_nth_line(file_name: str, line_number: int) -> str:
    file_path = ROOT / file_name
    with file_path.open("r", encoding="utf-8") as handle:
        for current, line in enumerate(handle, start=1):
            if current == line_number:
                return line.strip()
    raise ValueError(f"Không tìm thấy dòng {line_number} trong {file_name}")


def build_demo_records() -> dict:
    course_a_line = read_nth_line("courses.txt", 1)
    enrollment_a_line = read_nth_line("enrollments.txt", 2)
    student_a_line = read_nth_line("students.txt", 78)
    student_b_line = read_nth_line("students.txt", 128)
    course_b_line = read_nth_line("courses.txt", 10)

    course_a = Course.from_line(course_a_line)
    enrollment_a = Enrollment.from_line(enrollment_a_line)
    student_a = Student.from_line(student_a_line)
    student_b = Student.from_line(student_b_line)
    course_b = Course.from_line(course_b_line)

    return {
        "course_a": RecordSeed("course_a", "Course#1", course_a_line, course_a.to_fields()),
        "enrollment_a": RecordSeed("enrollment_a", "Enroll#2", enrollment_a_line, enrollment_a.to_fields()),
        "student_a": RecordSeed("student_a", "Student#78", student_a_line, student_a.to_fields()),
        "student_b": RecordSeed("student_b", "Student#128", student_b_line, student_b.to_fields()),
        "course_b": RecordSeed("course_b", "Course#10", course_b_line, course_b.to_fields()),
    }


def format_ms(elapsed_ms: float) -> str:
    return f"{elapsed_ms:.3f} ms"


def time_call(func, *args, **kwargs):
    start = perf_counter()
    result = func(*args, **kwargs)
    return result, (perf_counter() - start) * 1000


def shorten(text: str, limit: int = 44) -> str:
    return text if len(text) <= limit else text[: limit - 3] + "..."


def print_state(page, slot_labels: dict, title: str):
    header = page._read_header()
    print(f"\n[{title}]")
    print(
        f"Header={header.header_size}B | free_start={header.header_size} | "
        f"free_end={header.free_space_ptr} | free={page.free_space()}B"
    )
    if header.num_entries == 0:
        print("Chưa có slot nào.")
        return

    for slot_id in range(header.num_entries):
        slot = page._read_slot(slot_id)
        label = slot_labels.get(slot_id, "Chưa gán")
        if slot.is_empty:
            print(f"Slot {slot_id}: rỗng | nhãn cũ {label}")
            continue
        raw = page.get(slot_id).decode("utf-8")
        print(
            f"Slot {slot_id}: {label} | off={slot.offset} | len={slot.length} | "
            f"data={shorten(raw)}"
        )


def insert_seed(page, slot_labels: dict, seed: RecordSeed) -> tuple[int, float]:
    payload = encode_record(seed.fields)
    slot_id, elapsed_ms = time_call(page.insert, payload)
    if slot_id == -1:
        raise RuntimeError(f"Không đủ chỗ để chèn {seed.label}")
    slot_labels[slot_id] = seed.label
    return slot_id, elapsed_ms


def delete_slot(page, slot_id: int) -> float:
    _, elapsed_ms = time_call(page.delete, slot_id)
    return elapsed_ms


def compact_page(page) -> tuple[dict, float]:
    moved, elapsed_ms = time_call(page.compact)
    return moved, elapsed_ms


def seed_page(page_size: int = 256):
    records = build_demo_records()
    page = SlottedPage(page_size=page_size)
    slot_labels = {}
    inserted = []

    for key in ["course_a", "enrollment_a", "student_a", "student_b"]:
        seed = records[key]
        slot_id, elapsed_ms = insert_seed(page, slot_labels, seed)
        inserted.append((seed, slot_id, elapsed_ms))

    return page, slot_labels, records, inserted
