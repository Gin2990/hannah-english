# 📘 HƯỚNG DẪN BIÊN SOẠN ĐỀ THI & FILE NGHE (LISTENING) CHUẨN QUỐC TẾ
## HỆ THỐNG HANNAH ENGLISH & EDUMETRICS

Tài liệu này hướng dẫn chi tiết quy trình cho Giảng viên (Teacher) và Quản trị viên (Admin) để khởi tạo đề thi, quản lý tệp âm thanh nghe thử (Listening) trực tuyến và sử dụng công cụ nhập liệu tự động thông minh bằng AI.

---

## 📁 PHẦN 1: QUẢN LÝ VÀ TẢI LÊN FILE NGHE (.MP3) TRÊN SUPABASE
Để phục vụ cho các bài thi thử Listening (IELTS/TOEIC) chuẩn quốc tế, tệp âm thanh cần được lưu trữ trên dịch vụ đám mây công khai để có tốc độ phát nhạc nhanh và mượt mà.

### Các bước thực hiện:
1. **Truy cập Supabase**: Đăng nhập vào tài khoản quản trị của bạn tại [Supabase Dashboard](https://supabase.com/dashboard).
2. **Vào kho lưu trữ (Storage)**:
   - Ở thanh công cụ bên trái màn hình, chọn biểu tượng **Storage** (hình hộp vuông 📦).
3. **Tạo Bucket chứa đề thi nghe (chỉ cần làm lần đầu tiên)**:
   - Nhấn vào nút **New Bucket**.
   - Đặt tên cho bucket là: `exam-assets`.
   - **BẮT BUỘC**: Bật (Enable) tùy chọn **Public bucket** (Điều này cho phép trình phát nhạc trên trang web local có thể đọc được file âm thanh của bạn).
   - Nhấn **Save**.
4. **Tải lên (Upload) file nghe**:
   - Nhấp chọn bucket `exam-assets` vừa tạo.
   - Nhấn **Upload File** hoặc kéo thả file nghe `.mp3` của bạn trực tiếp vào giao diện.
5. **Lấy liên kết file nghe (Public URL)**:
   - Sau khi file nghe tải lên thành công, click chuột vào file `.mp3` đó.
   - Nhấn vào nút **Get URL** để sao chép đường link công khai.
   - Đường link sẽ có dạng: 
     `https://[project-id].supabase.co/storage/v1/object/public/exam-assets/[ten-file-nghe].mp3`

---

## 📋 PHẦN 2: HƯỚNG DẪN SỬ DỤNG AI AIKEN IMPORTER (NHẬP ĐỀ NHANH)
Để tránh việc nhập thủ công từng câu hỏi trắc nghiệm cực kỳ mất thời gian, hệ thống đã trang bị bộ phân tích **Aiken Format**. Bạn có thể dùng AI (như ChatGPT) soạn đề rồi paste vào trong 1 giây.

### Quy chuẩn định dạng Aiken:
Văn bản câu hỏi của bạn phải tuân thủ nghiêm ngặt quy tắc sau:
1. Dòng đầu tiên là nội dung câu hỏi (có hoặc không có số thứ tự đầu câu đều được).
2. Các dòng tiếp theo là 4 đáp án lựa chọn bắt đầu bằng chữ cái in hoa kèm dấu chấm và dấu cách: **`A. `**, **`B. `**, **`C. `**, **`D. `**.
3. Dòng tiếp theo là đáp án đúng, bắt đầu bằng từ khóa **`ANSWER: `** kèm chữ cái đáp án đúng.
4. Mỗi câu hỏi cách nhau bởi ít nhất một dòng trống.

### Ví dụ mẫu (Aiken format):
```txt
Chọn từ thích hợp điền vào chỗ trống: "She ___ English fluently."
A. speak
B. speaks
C. speaking
D. spoken
ANSWER: B

Which word is a noun?
A. beautiful
B. sing
C. teacher
D. quickly
ANSWER: C
```

### 💡 Mẫu Câu Lệnh (Prompt) gửi ChatGPT để tạo đề tức thì:
Bạn chỉ cần copy câu lệnh này và gửi cho ChatGPT để nó tự động soạn đề chuẩn định dạng Aiken cho bạn:
> *"Hãy soạn cho tôi một bộ đề gồm [Số lượng] câu hỏi trắc nghiệm tiếng Anh phần [IELTS/TOEIC/Ngữ pháp] với cấu trúc 4 đáp án trắc nghiệm A, B, C, D. Định dạng đầu ra bắt buộc phải theo chuẩn Aiken Format chính xác như sau:
> Dòng 1: Nội dung câu hỏi.
> Dòng 2: A. [Đáp án]
> Dòng 3: B. [Đáp án]
> Dòng 4: C. [Đáp án]
> Dòng 5: D. [Đáp án]
> Dòng 6: ANSWER: [Chữ cái viết hoa đáp án đúng]
> Cách mỗi câu hỏi bằng một dòng trống. Không thêm bất kỳ lời dẫn hay ghi chú nào khác ngoài định dạng trên."*

---

## ⚡ PHẦN 3: TIẾN HÀNH SOẠN THẢO VÀ XUẤT BẢN ĐỀ THI
Khi đã có Link File Nghe và Danh sách câu hỏi, giáo viên thực hiện các bước sau trên web:

1. Đăng nhập với tài khoản có vai trò **Teacher** hoặc **Admin**.
2. Truy cập cổng giảng viên tại: **[http://localhost:5173/teacher](http://localhost:5173/teacher)**.
3. Điền các thông tin tổng quan của đề:
   - **Tiêu đề**: Tên bài thi (Ví dụ: *TOEIC Listening Test 01*).
   - **Khóa học Target**: Chọn khóa học cần gán (IELTS hoặc TOEIC).
   - **Loại đề bài**: 
     - Chọn **Bài Test** nếu muốn làm bài thi thử bấm giờ nghiêm ngặt, tự động nộp bài khi hết giờ.
     - Chọn **Bài Tập** nếu muốn làm bài tập luyện tập, không tính thời gian làm bài.
   - **Thời gian (phút)**: Thời gian làm bài mong muốn (Ví dụ: *45 phút*).
   - **Link Audio (.mp3)**: Dán đường dẫn public URL đã lấy được từ **Phần 1** ở trên vào đây (bỏ trống nếu là đề Reading/Ngữ pháp không có file nghe).
4. **Nhập câu hỏi**:
   - Nhấn nút **Nhập nhanh từ File/Text (Aiken format) 📋**.
   - Dán đoạn đề thi chuẩn Aiken thu được từ file Word hoặc ChatGPT vào khung nhập liệu.
   - Nhấn **Import Ngay**. Hệ thống sẽ tự động điền và tạo toàn bộ danh sách câu hỏi trực quan dưới dạng thẻ bài.
   - Bạn có thể chỉnh sửa lại nội dung bất kỳ câu nào hoặc đổi đáp án đúng nếu muốn.
5. **Xuất bản**:
   - Nhấn nút **Xuất bản đề thi** màu xanh navy ở góc dưới. Đề thi sẽ ngay lập tức được đẩy lên cơ sở dữ liệu online và hiển thị trong danh mục học tập của học viên!

---

## 🔒 PHẦN 4: BẢO MẬT & TRẢI NGHIỆM HỌC VIÊN
* **Giao diện học viên**: Học viên được phân quyền khóa học tương ứng sẽ nhìn thấy đề thi. Nếu là đề thi nghe, một **Trình nghe Audio chuyên nghiệp (Sticky Audio Player)** sẽ tự động xuất hiện và bám dính lơ lửng ngay dưới thanh Menu khi học viên cuộn chuột xuống làm bài.
* **Bảo mật Audio**: Trình phát nhạc đã được tắt tính năng tải tệp (`controlsList="nodownload"`), giúp bảo vệ bản quyền tài nguyên số của trung tâm, tránh việc học viên tải trộm đề nghe về máy.
* **Tự động chấm điểm**: Ngay khi học viên nhấn **Nộp bài**, hệ thống tự chấm điểm trực tuyến và lưu ngay lịch sử vào bảng `exam_results` của Supabase. Giảng viên và Admin có thể theo dõi biểu đồ tiến độ học tập và bảng điểm chi tiết của lớp học bất kỳ lúc nào tại Dashboard!
