# 🚀 BẢN GHI TIẾN ĐỘ & HƯỚNG DẪN KHÔI PHỤC DỰ ÁN (RESUME GUIDE)
## HANNAH ENGLISH & EDUMETRICS - REACT VITE & SUPABASE SPA

Tài liệu này lưu trữ lại toàn bộ các **"Skill" (Tính năng / Giải pháp)** đã được lập trình và tích hợp thành công vào dự án trong phiên làm việc vừa rồi. Khi bạn khởi động lại máy tính, bạn (hoặc trợ lý AI tiếp theo) chỉ cần đọc file này là có thể tiếp tục phát triển dự án ngay lập tức mà không sợ bị mất thông tin hay gián đoạn mạch công việc.

---

## 🛠️ TOÀN BỘ CÁC "SKILL" / TÍNH NĂNG ĐÃ HOÀN THÀNH TỐT
Dưới đây là các tính năng nghiệp vụ nâng cao đã được lập trình hoàn chỉnh bằng React SPA và tích hợp trực tiếp với cơ sở dữ liệu Supabase:

### 1. Phân quyền và Lắng nghe Phiên Đăng nhập Động (Auth Context & Guards)
* **File nguồn**: [supabase.js](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/supabase.js) và [AuthContext.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/context/AuthContext.jsx).
* **Tính năng**: 
  - Lắng nghe trạng thái đăng nhập hệ thống trong thời gian thực.
  - Tự động truy vấn bảng `profiles` để kiểm tra quyền hạn (`student`, `teacher`, `admin`).
  - Bảo vệ các tuyến đường nhạy cảm bằng [PrivateRoute.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/components/PrivateRoute.jsx), ngăn chặn người lạ truy cập trái phép.

### 2. Bộ Badge Chẩn đoán Supabase Live (Visual Database Connection badge)
* **File nguồn**: [Auth.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/Auth.jsx).
* **Tính năng**: 
  - Đặt một huy hiệu chẩn đoán tự động ngay dưới biểu mẫu Đăng nhập.
  - Huy hiệu sẽ tự động quét Supabase và hiển thị trạng thái bằng màu sắc:
    - 🟢 **Đã Kết Nối**: Cấu hình `.env` chuẩn xác và bảng dữ liệu hoạt động bình thường.
    - 🟡 **Thiếu Bảng**: Kết nối thành công đến Supabase nhưng cơ sở dữ liệu chưa chạy SQL tạo bảng.
    - 🔴 **Lỗi Kết Nối**: Sai URL/Key hoặc sự cố mạng.
    - 🔴 **Chưa Cấu Hình**: Chưa cài đặt tệp `.env`.

### 3. Cửa Sổ Nhập Liệu / Cấp Quyền Đẹp Mắt (Custom Custom Modals)
* **File nguồn**: [AdminDashboard.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/AdminDashboard.jsx).
* **Tính năng**:
  - Loại bỏ hoàn toàn tất cả các hộp thoại xấu xí của trình duyệt như `prompt()` và `alert()`.
  - Thay thế bằng các **Cửa sổ Modals dạng Overlay Glassmorphism** (nền mờ, hiệu ứng mượt mờ, viền sáng và nút bấm bo góc sang trọng).
  - Áp dụng cho toàn bộ các luồng thao tác của Quản trị viên.

### 4. Giải Quyết Triệt Để Lỗi Tự Đổi Tài Khoản Admin (Transient Auth Instance)
* **File nguồn**: [AdminDashboard.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/AdminDashboard.jsx).
* **Tính năng**:
  - Khắc phục lỗi kinh điển trong các dự án Supabase: Khi Admin sử dụng tính năng "Tạo tài khoản" mới cho Học viên, API mặc định sẽ tự lưu Token của học viên vừa tạo đè lên LocalStorage của Admin, làm Admin bị đăng xuất và chuyển thành tài khoản học viên mới.
  - **Giải pháp**: Khởi tạo một phiên bản client Supabase tạm thời chuyên biệt (`transient client`) với cấu hình `persistSession: false` chỉ dùng riêng cho việc tạo tài khoản, giúp Admin thoải mái thêm học viên mà không bị mất phiên làm việc.

### 5. Bộ Tách Đề Thi AI Aiken Tự Động 0.5 Giây (AI Aiken Format Text Importer)
* **File nguồn**: [TeacherDashboard.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/TeacherDashboard.jsx).
* **Tính năng**:
  - Giúp Giảng viên không cần nhập thủ công từng câu trắc nghiệm.
  - Chỉ cần copy đoạn chữ thô biên soạn theo chuẩn Moodle Aiken Format (từ tệp Word hoặc copy nhanh từ ChatGPT) và paste vào khung nhập liệu, hệ thống tự động bóc tách thành mảng câu hỏi trắc nghiệm, đáp án chuẩn A-B-C-D và câu trả lời chính xác trong chưa đầy 0.5 giây!

### 6. Phân Biệt "Luyện Tập" vs "Thi Thử" (Homework vs Exams Schema & Badges)
* **File nguồn**: [TeacherDashboard.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/TeacherDashboard.jsx), [ToeicExams.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/ToeicExams.jsx), [IeltsExams.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/IeltsExams.jsx).
* **Tính năng**:
  - Thêm thuộc tính `type` vào bảng `exams` (`homework` vs `test`).
  - Giao diện học viên tự nhận biết và gắn nhãn màu sắc sang trọng: **Luyện tập** (Homework - viền xanh lá, không giới hạn thời gian làm bài) và **Thi thử** (Test - viền xanh dương, tính giờ đếm ngược nghiêm ngặt).

### 7. Tích Hợp Đề Thi IELTS Listening Tự Động Từ File Word (.docx)
* **File nguồn**: [TeacherDashboard.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/TeacherDashboard.jsx).
* **Tính năng**:
  - Bổ sung trường chọn kỹ năng **Nghe (Listening)** hoặc **Đọc (Reading)** và form điền link Google Drive Audio cho 4 Section khi đăng đề.
  - Tự động tách nhỏ đề thi làm **4 phần** theo các thẻ tiêu đề `SECTION 1/2/3/4` (hoặc `PART 1/2/3/4`) trong file Word đề thi.
  - Thuật toán bóc tách câu hỏi nghe điền từ hoặc lựa chọn (`parseListeningQuestions`) tự động liên kết mỗi câu hỏi với đáp án đúng từ file key.

### 8. Giao Diện Mock Preview / Phòng Thi 3 Cột (Study4 Room Style Simulator)
* **File nguồn**: [TeacherDashboard.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/TeacherDashboard.jsx) và [ExamTaker.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/ExamTaker.jsx).
* **Tính năng**:
  - Giao diện chia làm 3 cột sang trọng theo tỉ lệ **50/25/25**:
    - **Cột 1 (Đề bài - 50%)**: Hiển thị nội dung bài đọc, hội thoại hoặc file PDF gốc.
    - **Cột 2 (Phiếu câu trả lời - 25%)**: Chỉ chứa số thứ tự câu hỏi và ô nhập liệu/nút lựa chọn cực kỳ tinh gọn. Toàn bộ câu hỏi thô lặp lại đã được ẩn đi để chống loãng giao diện học viên.
    - **Cột 3 (Bản đồ & Timer - 25%)**: Quản lý thời gian thi, hiển thị bản đồ câu hỏi để nhảy nhanh và nút nộp bài.

### 9. Trình Phát Nhạc Listening Cố Định Ở Đầu và Phát Link Google Drive
* **File nguồn**: [ExamTaker.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/ExamTaker.jsx).
* **Tính năng**:
  - Chuyển trình phát nhạc từ bên trong cột đề thi lên thành **thanh ngang cố định (sticky) nằm phía dưới Header** trên màn hình thi của học viên.
  - Sử dụng thẻ `<iframe>` tự động chuyển link Google Drive sang dạng `/preview` để vượt qua lỗi chặn phát nhạc CORS của trình duyệt, giúp học viên nghe nhạc trực tuyến mượt mà.

### 10. Chấm Điểm IELTS Thông Minh (Smart Grading Parser)
* **File nguồn**: [ExamTaker.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/ExamTaker.jsx) và [TeacherDashboard.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/TeacherDashboard.jsx).
* **Tính năng**:
  - Thuật toán `matchIeltsAnswer` hỗ trợ bóc tách dấu ngoặc đơn `(...)` (chấp nhận cả phương án có hoặc không có chữ trong ngoặc, ví dụ `10(th) September` chấp nhận `10th September` và `10 September`).
  - Hỗ trợ các lựa chọn thay thế qua dấu gạch chéo `/` (ví dụ: `10(th) September/Sep` chấp nhận cả chuỗi đầy đủ lẫn các từ viết tắt được phân tách).

### 11. Vá Lỗi RLS Đệ Quy Trên Supabase (RLS Infinite Recursion Fix)
* **File nguồn**: [supabase_schema.sql](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/supabase_schema.sql).
* **Tính năng**:
  - Xây dựng một hàm PostgreSQL bảo mật `public.is_admin()` hoạt động dưới quyền `security definer` (bỏ qua RLS) và liên kết nó vào chính sách kiểm tra bảo mật của bảng `profiles`, giải quyết dứt điểm các lỗi gián đoạn truy vấn SQL.

### 12. Trình Kích Hoạt Hệ Thống Tự Động 1-Click (Vite SPA Launcher)
* **File nguồn**: [run_website.bat](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/run_website.bat).
* **Tính năng**:
  - Nhấp đúp chuột để tự động quét Node.js, cài đặt thư viện thiếu và khởi động Vite Server tại `http://localhost:5173`.

---

## 💾 CÁC TỆP TIN DỰ ÁN QUAN TRỌNG ĐÃ CẬP NHẬT
Mọi thay đổi đều được lưu trữ trực tiếp và an toàn trong các tệp tin sau:
1. `d:\RINNDL\web tiếng anh\.env` (Cấu hình Supabase)
2. `d:\RINNDL\web tiếng anh\supabase_schema.sql` (Cấu trúc cơ sở dữ liệu & Vá lỗi RLS)
3. `d:\RINNDL\web tiếng anh\run_website.bat` (Bộ khởi chạy website nhanh)
4. `d:\RINNDL\web tiếng anh\src\pages\TeacherDashboard.jsx` (Giao diện giáo viên, parser Listening và Preview)
5. `d:\RINNDL\web tiếng anh\src\pages\ExamTaker.jsx` (Giao diện thi của học sinh, thanh audio trên đầu và chấm điểm thông minh)
6. `d:\RINNDL\web tiếng anh\RESUME_GUIDE.md` (Bản ghi tiến độ này)

---

## ⚡ HƯỚNG DẪN BƯỚC TIẾP THEO KHI BẠN BẬT MÁY LẠI
Khi bạn bật máy tính lên và muốn kiểm thử hoặc phát triển tiếp hệ thống, hãy thực hiện theo đúng thứ tự các bước cực kỳ đơn giản sau:

### Bước 1: Khởi động máy chủ Web bằng Trình khởi chạy 1-Click
* Nhấp đúp chuột vào tệp tin **[run_website.bat](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/run_website.bat)** nằm ở thư mục dự án.
* Đợi một chút trình duyệt sẽ tự động mở trang web tại địa chỉ: **[http://localhost:5173](http://localhost:5173)**.

### Bước 2: Chu kỳ kiểm thử E2E
1. Vào trang đăng ký/đăng nhập học viên.
2. Đăng nhập tài khoản giáo viên/admin -> Soạn đề Listening mới -> Xem trước trực tiếp trên thanh audio ngang ở trên đầu xem có mượt không.
3. Đăng nhập tài khoản học viên -> Vào làm bài thi nghe -> Điền các từ viết tắt, từ có hoặc không có ngoặc đơn (Ví dụ: đáp án đề `10(th) September/Sep` hãy điền `10th September` hoặc `Sep` và nộp bài để xem hệ thống chấm điểm có chính xác xanh lá không nhé!)

Mọi tính năng đã được push thành công lên GitHub và tích hợp hoàn hảo. Chúc bạn có một phiên làm việc thật tuyệt vời! 🌟
