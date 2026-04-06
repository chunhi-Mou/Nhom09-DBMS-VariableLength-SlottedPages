from dataclasses import dataclass


@dataclass(frozen=True)
class Student:
    student_id: int
    full_name: str
    class_name: str
    email: str
    phone: str

    @classmethod
    def from_line(cls, line: str) -> "Student":
        student_id, full_name, class_name, email, phone = line.strip().split(",")
        return cls(int(student_id), full_name, class_name, email, phone)

    def to_fields(self) -> list:
        return [self.student_id, self.full_name, self.class_name, self.email, self.phone]


@dataclass(frozen=True)
class Course:
    course_id: int
    course_name: str
    credits: int
    dept_name: str

    @classmethod
    def from_line(cls, line: str) -> "Course":
        course_id, course_name, credits, dept_name = line.strip().split(",")
        return cls(int(course_id), course_name, int(credits), dept_name)

    def to_fields(self) -> list:
        return [self.course_id, self.course_name, self.credits, self.dept_name]


@dataclass(frozen=True)
class Enrollment:
    student_id: int
    course_id: int
    semester: str
    score: float

    @classmethod
    def from_line(cls, line: str) -> "Enrollment":
        student_id, course_id, semester, score = line.strip().split(",")
        return cls(int(student_id), int(course_id), semester, float(score))

    def to_fields(self) -> list:
        return [self.student_id, self.course_id, self.semester, self.score]
