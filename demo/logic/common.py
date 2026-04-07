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


class Timer:
    def __init__(self):
        self.ms = 0.0
    def __enter__(self):
        self.start = perf_counter()
        return self
    def __exit__(self, *args):
        self.ms = (perf_counter() - self.start) * 1000

def seed_page(page_size: int = 256):
    records = build_demo_records()
    page = SlottedPage(page_size=page_size)
    slot_labels = {}
    inserted = []

    for key in ["course_a", "enrollment_a", "student_a", "student_b"]:
        seed = records[key]
        slot_id = page.insert(encode_record(seed.fields))
        slot_labels[slot_id] = seed.label
        inserted.append((seed, slot_id))

    return page, slot_labels, records, inserted
