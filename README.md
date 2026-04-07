# Mô Phỏng Cấu Trúc Slotted Page (Variable-Length Records)

Dự án này mô phỏng cách một Hệ Quản Trị Cơ Sở Dữ Liệu (DBMS) lưu trữ và quản lý các **bản ghi có chiều dài thay đổi** (variable-length records) thông qua cấu trúc **Trang có khe (Slotted Page)**.

## Tổng Quan Về Slotted Page
Slotted Page tối ưu không gian lưu trữ bằng cách chia một trang thành 2 phần di chuyển ngược chiều nhau:
- **Header (Đầu trang):** Phát triển từ trên xuống, chứa *Danh mục khe (Slot Directory)*. Mỗi khe lưu thông tin `[offset, chiều dài]` của bản ghi tương ứng.
- **Data (Cuối trang):** Phát triển từ dưới lên, chứa dữ liệu thực tế của các bản ghi.

**Giải quyết bài toán gì?**
Ngăn chặn lãng phí bộ nhớ do phân mảnh. Cho phép dữ liệu thoải mái thay đổi kích thước, dịch chuyển bên trong trang (dồn trang - compact) mà **không làm thay đổi Record ID** (địa chỉ ảo dạng `Page ID, Slot ID` mà các Index bên ngoài đang dùng).

## Độ Phức Tạp Thuật Toán (Phạm vi 1 Trang)
- **Truy xuất (Search):** `O(1)` - Tra cứu `offset` từ khe để nhảy thẳng tới dữ liệu.
- **Xóa (Delete):** `O(1)` - Đánh dấu khe là rỗng (`offset = -1`). Không tốn sức dịch chuyển dữ liệu ngay lúc xóa.
- **Chèn (Insert):** 
  - `O(N)` để quét tìm khe tái sử dụng (N là số lượng khe).
  - `O(P)` nếu bộ nhớ bị xé lẻ, hệ thống phải kích hoạt dồn trang (Compact) (P là kích thước trang).
- **Cập nhật (Update):** `O(1)` nếu nhẹ đi/giữ nguyên. `O(P)` nếu bản ghi phình to phải dồn không gian.

## Cấu Trúc Mã Nguồn (Python)
- `1-data.py`: Sinh bộ dữ liệu giả lập (Sinh viên, Lớp, Đăng ký môn học) có các trường biến độ dài.
- `2-record.py`: Đóng gói (encode)/giải nén (decode) dữ liệu thành luồng byte.
- `3-page.py`: **Chứa logic cốt lõi** - Hiện thực hóa lớp `SlottedPage` với các tương tác vật lý (viết Header, cấp slot, Insert, Delete, Compact).
- `demo/logic/`: Các kịch bản chạy thử (VD: Xóa bản ghi và xem ID slot vẫn giữ nguyên khi bộ nhớ bị dồn lại).

---
*Thực hiện bởi: Nhóm 09 - Lớp D23CQCE06-B (Học Viện Công Nghệ Bưu Chính Viễn Thông)*

Thành viên nhóm 9:
1. Phùng Thu Hương - B23DCVT201
2. Chu Tuyết Nhi - B23DCCE075
3. Lê Như Quỳnh - B23DCCE081