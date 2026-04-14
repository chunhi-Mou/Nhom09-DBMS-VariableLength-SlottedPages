(function () {
    const LIVE_RECORDS = [
        {
            key: "course_a",
            label: "Course#1",
            data: "1,Course_1,3,Dept_5",
        },
        {
            key: "enrollment_a",
            label: "Enroll#2",
            data: "99555,34,2023-2,8.93",
        },
        {
            key: "student_a",
            label: "Student#78",
            data: "78,Nguyen Trang,CNTT1,nguyentrang78@gmail.com,0560585664",
        },
        {
            key: "student_b",
            label: "Student#128",
            data: "128,Nguyen Minh,CNTT3,nguyenminh128@gmail.com,0968171253",
        },
        {
            key: "course_b",
            label: "Course#10",
            data: "10,Course_10,4,Dept_5",
        },
        {
            key: "tiny_a",
            label: "Tiny#A",
            data: "A,ok",
        },
        {
            key: "wide_a",
            label: "Wide#A",
            data: "200,Tran Thi Long Name,CNTT9,tranlongname200@gmail.com,0900000000,ghi-chu-dai",
        },
    ];

    const TABLE_ORDER = ["students", "courses", "enrollments"];

    function createInitialUserTables() {
        return {
            students: {
                title: "Student",
                accent: "student",
                prefix: "S",
                nextId: 2,
                columns: ["student_id", "full_name", "class_name", "email", "phone"],
                rows: [
                    {
                        __stt: 1,
                        __tag: "S#1",
                        student_id: "78",
                        full_name: "Nguyen Trang",
                        class_name: "CNTT1",
                        email: "nguyentrang78@gmail.com",
                        phone: "0560585664",
                    },
                ],
            },
            courses: {
                title: "Course",
                accent: "course",
                prefix: "C",
                nextId: 2,
                columns: ["course_id", "course_name", "credits", "dept_name"],
                rows: [
                    {
                        __stt: 1,
                        __tag: "C#1",
                        course_id: "1",
                        course_name: "Course_1",
                        credits: "3",
                        dept_name: "Dept_5",
                    },
                ],
            },
            enrollments: {
                title: "Enrollment",
                accent: "enrollment",
                prefix: "E",
                nextId: 2,
                columns: ["student_id", "course_id", "semester", "score"],
                rows: [
                    {
                        __stt: 1,
                        __tag: "E#1",
                        student_id: "78",
                        course_id: "1",
                        semester: "2023-2",
                        score: "8.93",
                    },
                ],
            },
        };
    }

    function rowToSeed(tableKey, row) {
        const { Student, Course, Enrollment } = window.PageModels;
        const tag = row.__tag || "";

        if (tableKey === "students") {
            const studentId = String(row.student_id || "").trim();
            const fullName = String(row.full_name || "").trim();
            const className = String(row.class_name || "").trim();
            const email = String(row.email || "").trim();
            const phone = String(row.phone || "").trim();
            if (!studentId || !fullName || !className || !email || !phone) {
                return null;
            }
            const model = new Student(studentId, fullName, className, email, phone);
            return { label: tag || "S#?", data: model.toFields().join(",") };
        }

        if (tableKey === "courses") {
            const courseId = String(row.course_id || "").trim();
            const courseName = String(row.course_name || "").trim();
            const credits = String(row.credits || "").trim();
            const deptName = String(row.dept_name || "").trim();
            if (!courseId || !credits || !courseName || !deptName) {
                return null;
            }
            const model = new Course(courseId, courseName, credits, deptName);
            return { label: tag || "C#?", data: model.toFields().join(",") };
        }

        if (tableKey === "enrollments") {
            const studentId = String(row.student_id || "").trim();
            const courseId = String(row.course_id || "").trim();
            const semester = String(row.semester || "").trim();
            const score = String(row.score || "").trim();
            if (!studentId || !courseId || !score || !semester) {
                return null;
            }
            const model = new Enrollment(studentId, courseId, semester, score);
            return { label: tag || "E#?", data: model.toFields().join(",") };
        }

        return null;
    }

    window.LiveData = {
        LIVE_RECORDS,
        TABLE_ORDER,
        createInitialUserTables,
        rowToSeed,
    };
})();
