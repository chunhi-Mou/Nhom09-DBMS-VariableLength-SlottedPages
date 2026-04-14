import random
import string

NUM_STUDENTS = 100000
NUM_COURSES = 100
NUM_ENROLLMENTS = 1000000

# Helper functions
def random_name():
    first = ["An", "Binh", "Chi", "Dung", "Hanh", "Khanh", "Linh", "Minh", "Nam", "Trang"]
    last = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Vu"]
    return random.choice(last) + " " + random.choice(first)

def random_email(name, id):
    return name.replace(" ", "").lower() + str(id) + "@gmail.com"

def random_phone():
    return "0" + "".join(random.choices(string.digits, k=9))

# Generate Students
with open("students.txt", "w", encoding="utf-8") as f:
    for i in range(1, NUM_STUDENTS + 1):
        name = random_name()
        student = f"{i},{name},CNTT{random.randint(1,4)},{random_email(name, i)},{random_phone()}\n"
        f.write(student)

# Generate Courses
courses = []
with open("courses.txt", "w", encoding="utf-8") as f:
    for i in range(1, NUM_COURSES + 1):
        course = f"{i},Course_{i},{random.randint(2,4)},Dept_{random.randint(1,5)}\n"
        f.write(course)
        courses.append(i)

# Generate Enrollments
with open("enrollments.txt", "w", encoding="utf-8") as f:
    for _ in range(NUM_ENROLLMENTS):
        student_id = random.randint(1, NUM_STUDENTS)
        course_id = random.choice(courses)
        semester = f"202{random.randint(1,4)}-{random.randint(1,2)}"
        score = round(random.uniform(0, 10), 2)

        record = f"{student_id},{course_id},{semester},{score}\n"
        f.write(record)

print("Dataset generated.")