(function () {
    class Student {
        constructor(studentId, fullName, className, email, phone) {
            this.student_id = studentId;
            this.full_name = fullName;
            this.class_name = className;
            this.email = email;
            this.phone = phone;
        }

        static fromLine(line) {
            const [studentId, fullName, className, email, phone] = line.trim().split(",");
            return new Student(Number(studentId), fullName, className, email, phone);
        }

        toFields() {
            return [this.student_id, this.full_name, this.class_name, this.email, this.phone];
        }
    }

    class Course {
        constructor(courseId, courseName, credits, deptName) {
            this.course_id = courseId;
            this.course_name = courseName;
            this.credits = credits;
            this.dept_name = deptName;
        }

        static fromLine(line) {
            const [courseId, courseName, credits, deptName] = line.trim().split(",");
            return new Course(Number(courseId), courseName, Number(credits), deptName);
        }

        toFields() {
            return [this.course_id, this.course_name, this.credits, this.dept_name];
        }
    }

    class Enrollment {
        constructor(studentId, courseId, semester, score) {
            this.student_id = studentId;
            this.course_id = courseId;
            this.semester = semester;
            this.score = score;
        }

        static fromLine(line) {
            const [studentId, courseId, semester, score] = line.trim().split(",");
            return new Enrollment(Number(studentId), Number(courseId), semester, Number(score));
        }

        toFields() {
            return [this.student_id, this.course_id, this.semester, this.score];
        }
    }

    window.PageModels = {
        Student,
        Course,
        Enrollment,
    };
})();
