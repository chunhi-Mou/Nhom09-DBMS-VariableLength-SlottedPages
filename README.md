# Mô Phỏng Slotted Page Cho Variable-Length Record

Dự án mô phỏng cách DBMS quản lý bản ghi độ dài thay đổi bằng cấu trúc Slotted Page.
Mục tiêu chính là quan sát rõ các thao tác insert, delete, reuse slot, compact và giữ ổn định Record ID `(page_id, slot_id)`.

## Kiến Trúc Hiện Tại

### 1) Tầng logic Slotted Page
- `demo/logic/page.js`
  - Cấu trúc lõi: `Header + Slot Directory + Payload`
  - Các thao tác vật lý: `insert`, `delete`, `compact`, `snapshot`
  - Quy tắc chính:
    - Ưu tiên tái sử dụng slot rỗng
    - Nếu thiếu bộ nhớ trống liền khối nhưng tổng bộ nhớ trống đủ thì compact rồi chèn
    - Chỉ co slot directory khi slot rỗng nằm ở đuôi
- `demo/logic/record.js`
  - Hàm encode/decode record
  - Hàm dựng trạng thái mô phỏng để render
- `demo/logic/models.js`
  - Model `Student`, `Course`, `Enrollment`
- `demo/logic/data.js`
  - Nạp dữ liệu patch từ thư mục `Data`
  - Theo dõi cursor import theo từng bảng

### 2) Tầng giao diện web
- `demo/web/index.html`
- `demo/web/page_visual.js`
- `demo/web/page_visual.css`
- `demo/web/page_controller.js`

### 3) Tầng server Python (serve HTML + lắng nghe API)
- `demo/web/server.py`
  - Serve trang demo
  - Lắng nghe API đọc/ghi dữ liệu
  - Đồng bộ xuống:
    - `Database/database-Student.txt`
    - `Database/database-Course.txt`
    - `Database/database-Enrollment.txt`

## Luồng Slotted Page Cốt Lõi
1. Insert record vào vùng nhớ trống liên tiếp khả dụng
2. Slot directory lưu `(offset, length)` cho từng slot
3. Delete chỉ đánh dấu slot rỗng, không dồn dữ liệu ngay
4. Khi phân mảnh tăng, compact dồn record lại thành một khối bộ nhớ trống liên tục
5. RID ổn định vì slot id không đổi khi record dịch chuyển

## Độ Phức Tạp (Trong 1 Page)
- Search: `O(1)` theo slot id
- Delete: `O(1)` đánh dấu rỗng
- Insert:
  - `O(N)` quét slot tái sử dụng
  - `O(P)` nếu cần compact
- Compact: `O(P)` theo dữ liệu trong page

## Cách Chạy Demo

### Yêu cầu
- Python 3.10+
- Trình duyệt web

### Chạy server HTML + Python lắng nghe sự kiện
Tại thư mục gốc project, chạy:

```bash
python demo/web/server.py --port 5500
```

Mở trình duyệt:

```text
http://127.0.0.1:5500/demo/web/index.html
```

Lưu ý:
- `server.py` là điểm chạy chính cho demo hiện tại
- Server này vừa serve HTML vừa lắng nghe API đồng bộ dữ liệu

## API Demo
- `GET /api/data`
  - Đọc dữ liệu hiện tại từ 3 file trong `Database`
- `POST /api/data`
  - Ghi full dữ liệu từ UI xuống 3 file `Database`
- `POST /api/data/op`
  - Hỗ trợ thao tác mức bản ghi (`insert`, `update`, `delete` theo line)

## Cấu Trúc Thư Mục

```text
Data/
  students.txt
  courses.txt
  enrollments.txt

Database/
  database-Student.txt
  database-Course.txt
  database-Enrollment.txt

demo/
  logic/
    data.js
    models.js
    page.js
    record.js
  web/
    index.html
    page_controller.js
    page_visual.css
    page_visual.js
    server.py

src/
  1-data.py
  2-record.py
  3-page.py
```

---

Thực hiện bởi Nhóm 09 - D23CQCE06-B - Học viện Công nghệ Bưu chính Viễn thông

Thành viên:
1. Phùng Thu Hương - B23DCVT201
2. Chu Tuyết Nhi - B23DCCE075
3. Lê Như Quỳnh - B23DCCE081