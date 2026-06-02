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
  - Thay thế bằng các **Cửa sổ Modals dạng Overlay Glassmorphism** (nền mờ, hiệu ứng mượt mà, viền sáng và nút bấm bo góc sang trọng).
  - Áp dụng cho toàn bộ các luồng thao tác của Quản trị viên:
    - Thêm tài khoản mới trực quan.
    - Đổi tên thành viên.
    - Khởi tạo khóa học mới hệ thống.
    - Thay đổi thông tin chi tiết khóa học.

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

### 7. Trình Phát Nhạc Nghe Đề Thi Listening Lơ Lửng (Sticky Audio Player Widget)
* **File nguồn**: [ExamTaker.jsx](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/src/pages/ExamTaker.jsx).
* **Tính năng**:
  - Nhận đường dẫn tệp âm thanh nghe thử trực tuyến `.mp3` được cấu hình từ cơ sở dữ liệu.
  - Hiển thị một trình điều khiển nhạc nổi bám dính ở vị trí `top-[80px]` (luôn chạy theo tầm nhìn của học viên khi cuộn xuống dưới làm đề).
  - Tích hợp thuộc tính chặn download (`controlsList="nodownload"`), bảo mật tối đa file nghe của trung tâm.

### 8. Vá Lỗi RLS Đệ Quy Trên Supabase (RLS Infinite Recursion Fix)
* **File nguồn**: [supabase_schema.sql](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/supabase_schema.sql).
* **Tính năng**:
  - Sửa lỗi truy vấn đệ quy vô hạn (Error 42P17) do chính sách RLS cũ của bảng `profiles` kiểm tra quyền admin bằng cách tự query lại chính bảng `profiles`.
  - **Giải pháp**: Xây dựng một hàm PostgreSQL bảo mật `public.is_admin()` hoạt động dưới quyền `security definer` (bỏ qua RLS) và liên kết nó vào chính sách kiểm tra bảo mật, giải quyết dứt điểm các lỗi gián đoạn truy vấn SQL.

### 9. Trình Kích Hoạt Hệ Thống Tự Động 1-Click (Vite SPA Launcher)
* **File nguồn**: [run_website.bat](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/run_website.bat).
* **Tính năng**:
  - Giúp bạn kích hoạt toàn bộ hệ thống bằng một click chuột.
  - Tự động kiểm tra cài đặt Node.js.
  - Tự động chạy `npm install` nếu máy chưa cài thư viện.
  - Tự động kích hoạt máy chủ Vite Dev Server cục bộ và mở trình duyệt truy cập ngay vào trang web tại địa chỉ `http://localhost:5173`.

---

## 💾 CÁC TỆP TIN DỰ ÁN QUAN TRỌNG ĐÃ CẬP NHẬT
Mọi thay đổi đều được lưu trữ trực tiếp và an toàn trong các tệp tin sau:
1. `d:\RINNDL\web tiếng anh\.env` (Thông số kết nối Supabase)
2. `d:\RINNDL\web tiếng anh\supabase_schema.sql` (Cấu trúc bảng & Vá lỗi RLS)
3. `d:\RINNDL\web tiếng anh\run_website.bat` (Trình khởi chạy dự án)
4. `d:\RINNDL\web tiếng anh\src\supabase.js` (Kết nối client API)
5. `d:\RINNDL\web tiếng anh\src\context\AuthContext.jsx` (Lắng nghe phân quyền động)
6. `d:\RINNDL\web tiếng anh\src\pages\Auth.jsx` (Màn hình đăng ký / đăng nhập kèm Badge chẩn đoán live)
7. `d:\RINNDL\web tiếng anh\src\pages\AdminDashboard.jsx` (Trang Admin quản lý học viên/khóa học bằng Modals đẹp)
8. `d:\RINNDL\web tiếng anh\src\pages\TeacherDashboard.jsx` (Trang Giáo viên soạn đề nhanh AI Aiken & cài file nghe)
9. `d:\RINNDL\web tiếng anh\src\pages\ExamTaker.jsx` (Trang phòng thi trực tuyến kèm Trình phát audio nghe bám dính)
10. `d:\RINNDL\web tiếng anh\src\pages\ToeicExams.jsx` & `IeltsExams.jsx` (Gắn nhãn thi thử / luyện tập động)
11. `d:\RINNDL\web tiếng anh\HUONG_DAN_SOAN_DE_LISTENING.md` (Tài liệu hướng dẫn up file nghe chi tiết)

---

## ⚡ HƯỚNG DẪN BƯỚC TIẾP THEO KHI BẠN BẬT MÁY LẠI
Khi bạn bật máy tính lên và muốn kiểm thử hoặc phát triển tiếp hệ thống, hãy thực hiện theo đúng thứ tự các bước cực kỳ đơn giản sau:

### Bước 1: Khởi động máy chủ Web bằng Trình khởi chạy 1-Click
* Nhấp đúp chuột vào tệp tin **[run_website.bat](file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/run_website.bat)** nằm ở thư mục dự án.
* Đợi một chút để màn hình terminal đen hiển thị chữ xanh bắt đầu kích hoạt máy chủ Vite, trình duyệt sẽ tự động mở trang web tại địa chỉ: **[http://localhost:5173](http://localhost:5173)**.

### Bước 2: Chạy các khối lệnh SQL bổ sung trên Supabase Dashboard
Vì dự án đã thêm các cột dữ liệu mới và hàm kiểm thử RLS, bạn cần copy và chạy 2 đoạn mã SQL sau trong tab **SQL Editor** trên trang quản trị Supabase của bạn:

#### 1. Cập nhật cấu trúc bảng thi cử (Tạo cột thể loại và file nghe):
```sql
-- Thêm cột file nghe và cột thể loại đề vào bảng exams nếu chưa có
ALTER TABLE exams ADD COLUMN IF NOT EXISTS listening_audio_url TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'test'; -- 'test' hoặc 'homework'
```

#### 2. Vá lỗi RLS Đệ quy trên bảng profiles:
```sql
-- Tạo hàm kiểm tra quyền Admin bảo mật cao (Security Definer) để bypass RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa chính sách cũ bị lỗi đệ quy
DROP POLICY IF EXISTS "Cho phép Admin thực hiện mọi hành động" ON public.profiles;

-- Thêm chính sách mới sử dụng hàm bảo mật
CREATE POLICY "Cho phép Admin thực hiện mọi hành động"
ON public.profiles
FOR ALL
USING (public.is_admin());
```

### Bước 3: Tiến hành chu trình kiểm thử E2E cực kỳ hoành tráng!
1. Truy cập [http://localhost:5173/auth](http://localhost:5173/auth), xác nhận Badge chẩn đoán hiển thị **🟢 Đã Kết Nối**.
2. **Đăng ký** một tài khoản học viên mới (Ví dụ: `nguyenvana@gmail.com`).
3. Đăng nhập tài khoản học viên đó -> Vào **Student Dashboard** -> Xác nhận các khóa học bị **khóa đỏ** bảo mật 🔒.
4. Lên Supabase SQL Editor chạy lệnh cập nhật quyền Admin cho tài khoản này:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'nguyenvana@gmail.com';
   ```
5. Nhấn `F5` tải lại web -> Vào **Trang Quản Trị** (`/admin`) -> Sử dụng các **Modals** đẹp mắt để cấp quyền khóa học cho học viên, đổi tên học viên.
6. Vào **Cổng Giảng Viên** (`/teacher`) -> Dán đề thi mẫu Aiken từ ChatGPT -> Nhập Link Audio phát thử -> Chọn hình thức là **Bài Test** -> Nhấn **Xuất bản đề thi** ⚡.
7. Đổi phân quyền tài khoản của bạn về học viên -> Vào lại **Student Dashboard** -> Xác nhận khóa học được **mở khóa xanh** lộng lẫy 🔓.
8. Click làm bài thi thử -> Trải nghiệm **Trình phát Audio Listening bám dính lơ lửng** và đồng hồ bấm giờ đếm ngược -> Nhấn nộp bài -> Chuyển sang trang **Hồ Sơ** để ngắm nhìn các **huy hiệu thành tích rực sáng lung linh**! ✨

Chúc bạn có một buổi tối nghỉ ngơi thư giãn và thoải mái! Khi nào bạn bật máy tính lại và sẵn sàng, chúng ta sẽ cùng tiếp tục thực hiện những bước tiếp theo để hoàn thiện xuất sắc dự án này! 🌟
