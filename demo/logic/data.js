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
    const DATA_FILE_BY_TABLE = {
        students: "../../Data/students.txt",
        courses: "../../Data/courses.txt",
        enrollments: "../../Data/enrollments.txt",
    };
    const TABLE_PREFIX = {
        students: "S",
        courses: "C",
        enrollments: "E",
    };
    const patchCache = {
        students: [],
        courses: [],
        enrollments: [],
    };
    const patchCursor = {
        students: 0,
        courses: 0,
        enrollments: 0,
    };
    let patchSeedCounter = 1;

    async function readFirstLines(url, maxLines = 5000) {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok || !response.body) {
            throw new Error(`Không đọc được ${url}: HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const lines = [];

        while (lines.length < maxLines) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            let newlinePos = buffer.indexOf("\n");
            while (newlinePos !== -1 && lines.length < maxLines) {
                const line = buffer.slice(0, newlinePos).trim();
                buffer = buffer.slice(newlinePos + 1);
                if (line.length > 0) {
                    lines.push(line);
                }
                newlinePos = buffer.indexOf("\n");
            }
        }

        if (buffer.trim().length > 0 && lines.length < maxLines) {
            lines.push(buffer.trim());
        }

        try {
            await reader.cancel();
        } catch (_error) {
            // Reader may already be closed; safe to ignore.
        }

        return lines;
    }

    async function ensurePatchCache(tableKey, minLines = 5000) {
        const existing = patchCache[tableKey] || [];
        if (existing.length >= minLines) {
            return existing;
        }

        const filePath = DATA_FILE_BY_TABLE[tableKey];
        const lines = await readFirstLines(filePath, minLines);
        patchCache[tableKey] = lines;
        return lines;
    }

    async function importPatchSeeds(batchSize = 1000) {
        const safeBatch = Math.max(1, Number(batchSize) || 1000);
        await Promise.all(TABLE_ORDER.map((tableKey) => ensurePatchCache(tableKey, 5000)));

        const seeds = [];
        for (let index = 0; index < safeBatch; index += 1) {
            const tableKey = TABLE_ORDER[index % TABLE_ORDER.length];
            const rows = patchCache[tableKey];
            if (!rows || rows.length === 0) {
                continue;
            }

            const cursor = patchCursor[tableKey] % rows.length;
            patchCursor[tableKey] = cursor + 1;

            const prefix = TABLE_PREFIX[tableKey] || "R";
            seeds.push({
                tableKey,
                data: rows[cursor],
                label: `${prefix}#P${patchSeedCounter}`,
            });
            patchSeedCounter += 1;
        }

        return seeds;
    }

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
        importPatchSeeds,
    };
})();
