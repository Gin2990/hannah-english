# 🎓 Hannah English Portal — Kế Hoạch Phát Triển

> Cập nhật: 06/2026 | Stack: Vanilla HTML + Tailwind CSS + Supabase + Vercel

---

## 📊 Trạng Thái Hiện Tại

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Auth (Login/Signup) + Supabase | ✅ Hoàn chỉnh | Kết nối thật |
| Import đề thi từ .docx | ✅ Hoàn chỉnh | Auto parse câu hỏi |
| Kho bài giảng (teacher) | ✅ Hoạt động | Hiển thị danh sách thật |
| Thống kê teacher dashboard | ✅ Dữ liệu thật | 1HV / 2 bài / 1 lượt nộp |
| Kết quả học viên (teacher xem) | ✅ Cơ bản | Chỉ hiện tên + tổng điểm |
| Phòng thi (exam_taker.html) | ✅ Logic hoàn chỉnh | Đếm giờ, chấm điểm, lưu DB |
| Student Dashboard | ⚠️ Còn mock | Tên/điểm/tiến độ hardcode |
| Học viên tự vào làm bài | ⚠️ Chưa rõ | Chưa có flow rõ ràng |
| Phân quyền bài theo học viên | ❌ Chưa có UI | Schema có nhưng chưa dùng |
| Xem chi tiết kết quả | ❌ Chưa có | Chỉ hiện điểm tổng |

---

## 🗺️ Lộ Trình Phát Triển

---

### GIAI ĐOẠN 1 — Hoàn thiện luồng học viên *(ưu tiên cao nhất)*

> **Mục tiêu:** Học viên đăng nhập → thấy bài của mình → vào làm → xem điểm

#### Bước 1.1 — Kết nối Student Dashboard với Supabase
**File:** `js/student_dashboard.js`

- [ ] Lấy `currentUser` từ `auth.getUser()`
- [ ] Query `profiles` → hiển thị đúng tên học viên
- [ ] Query `student_courses` JOIN `courses` → hiển thị đúng khóa học được assign
- [ ] Query `exams` WHERE `course_id` IN (khóa học của học viên) → danh sách bài cần làm
- [ ] Query `exam_results` WHERE `student_id = currentUser.id` → lịch sử điểm thật
- [ ] Tính tiến độ: `số bài đã làm / tổng số bài trong khóa * 100`

```javascript
// Logic cần viết trong student_dashboard.js
async function loadStudentData() {
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. Lấy profile
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();

  // 2. Lấy khóa học được assign
  const { data: myCourses } = await supabase
    .from('student_courses')
    .select('course_id, courses(title, code)')
    .eq('student_id', user.id);

  // 3. Lấy bài tập theo khóa học
  const courseIds = myCourses.map(c => c.course_id);
  const { data: exams } = await supabase
    .from('exams').select('*').in('course_id', courseIds);

  // 4. Lấy lịch sử điểm
  const { data: results } = await supabase
    .from('exam_results').select('*, exams(title)')
    .eq('student_id', user.id).order('taken_at', { ascending: false });
}
```

---

#### Bước 1.2 — Trang danh sách bài tập cho học viên
**File mới:** `my_exams.html` hoặc tích hợp vào `student_dashboard.html`

- [ ] Hiển thị danh sách đề thi theo khóa học
- [ ] Mỗi bài hiển thị: tên bài, thời gian, số câu, trạng thái (Chưa làm / Đã làm X/Y)
- [ ] Nút **"Vào làm bài"** → link đến `exam_taker.html?id={exam_id}`
- [ ] Nếu đã làm rồi: hiện điểm + nút "Xem lại" hoặc "Làm lại"

```html
<!-- Card bài tập học viên -->
<div class="exam-card">
  <h3>IELTS Listening Test 1</h3>
  <span>40 phút • 40 câu</span>
  
  <!-- Chưa làm -->
  <a href="exam_taker.html?id=xxx" class="btn-primary">Vào làm bài →</a>
  
  <!-- Đã làm -->
  <span class="score-badge">38/40</span>
  <a href="result_detail.html?id=xxx">Xem kết quả</a>
</div>
```

---

#### Bước 1.3 — Kiểm tra và fix flow exam_taker
**File:** `exam_taker.html` + `js/auth_check.js`

- [ ] Xác nhận: học viên chỉ truy cập được bài thuộc khóa học của mình (check RLS)
- [ ] Nếu `exam_id` không tồn tại hoặc không có quyền → redirect về dashboard
- [ ] Sau khi nộp bài → redirect về student dashboard (không còn dùng mock)
- [ ] Fix: `goToDashboard()` hiện redirect cứng về `student_dashboard.html` ✓ (đã đúng)

---

### GIAI ĐOẠN 2 — Phân quyền bài & Quản lý học viên

> **Mục tiêu:** Teacher có thể assign bài cho từng học viên hoặc nhóm

#### Bước 2.1 — UI Assign học viên vào khóa học
**File:** `teacher_dashboard.html` (thêm modal)

- [ ] Thêm tab/section **"Quản lý học viên"** trong teacher dashboard
- [ ] Danh sách học viên từ `profiles WHERE role = 'student'`
- [ ] Modal: chọn học viên → chọn khóa học → INSERT `student_courses`
- [ ] Nút remove: DELETE `student_courses`

```javascript
// Assign học viên vào khóa học
async function assignStudentToCourse(studentId, courseId) {
  const { error } = await supabase
    .from('student_courses')
    .insert({ student_id: studentId, course_id: courseId });
}
```

#### Bước 2.2 — Quản lý tài khoản học viên
**File:** `admin_dashboard.html` (đã có sẵn)

- [ ] Xem toàn bộ danh sách học viên
- [ ] Đổi role (student ↔ teacher) cho tài khoản
- [ ] Reset/xóa tài khoản (nếu cần)
- [ ] Filter: xem học viên theo khóa học

---

### GIAI ĐOẠN 3 — Xem kết quả chi tiết

> **Mục tiêu:** Cả teacher và học viên xem được chi tiết từng câu đúng/sai

#### Bước 3.1 — Trang kết quả chi tiết
**File mới:** `result_detail.html`

- [ ] Nhận param: `?result_id=xxx`
- [ ] Load từ `exam_results JOIN exams`
- [ ] Hiển thị:
  - Điểm tổng, % chính xác, thời gian làm
  - Từng câu hỏi: đáp án học viên chọn vs đáp án đúng
  - Highlight ✅ đúng / ❌ sai
- [ ] Học viên: chỉ xem kết quả của mình
- [ ] Teacher: xem được kết quả của mọi học viên

```javascript
// Load kết quả chi tiết
async function loadResultDetail(resultId) {
  const { data } = await supabase
    .from('exam_results')
    .select('*, exams(title, questions)')
    .eq('id', resultId)
    .single();

  // So sánh data.answers với data.exams.questions[i].correct
  data.exams.questions.forEach((q, i) => {
    const studentAnswer = data.answers[i + 1];
    const isCorrect = studentAnswer === q.correct;
    // render câu hỏi với màu đúng/sai
  });
}
```

#### Bước 3.2 — Nâng cấp panel kết quả trong teacher dashboard
**File:** `js/teacher_dashboard.js`

- [ ] Panel "Kết Quả Làm Bài" hiện chỉ hiện tên + điểm → thêm:
  - Thời gian làm bài
  - % chính xác
  - Link "Xem chi tiết" → `result_detail.html?result_id=xxx`
- [ ] Filter theo bài thi cụ thể
- [ ] Sort theo điểm cao → thấp

---

### GIAI ĐOẠN 4 — Hỗ trợ Fill-in-the-blank

> **Mục tiêu:** Ngoài trắc nghiệm, hỗ trợ dạng điền chỗ trống

#### Bước 4.1 — Cập nhật schema câu hỏi
Thêm `type` vào JSONB `questions`:
```json
{
  "id": 1,
  "type": "multiple_choice",
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct": "A"
}

{
  "id": 2,
  "type": "fill_in_blank",
  "question": "The capital of France is ___.",
  "correct": "Paris",
  "accept_variants": ["paris", "PARIS"]
}
```

#### Bước 4.2 — Cập nhật exam_taker.html
- [ ] Detect `q.type` khi render câu hỏi
- [ ] Nếu `fill_in_blank` → render `<input type="text">` thay vì radio
- [ ] Khi chấm: so sánh lowercase, trim whitespace với `accept_variants`

#### Bước 4.3 — Cập nhật parser .docx
- [ ] Nhận diện câu hỏi điền chỗ trống (dạng `___` hoặc `....`)
- [ ] Tách đáp án từ file key

---

### GIAI ĐOẠN 5 — Dọn dẹp & Tối ưu *(làm cuối)*

#### Dọn repo GitHub
Xóa khỏi root (chuyển vào `/archive` hoặc xóa hẳn):
- [ ] `READING_28.txt`, `READING_KEY_28.txt`
- [ ] `READING 28.docx`, `READING KEY 28.docx`
- [ ] `IELTS Mock Test 1_LR Key.pdf`, `IELTS Mock Test 1_Listening Key.pdf`
- [ ] `IELTS Mock Test 2_Listening.pdf` và các Part PDF
- [ ] `extract_pdf.py`, `extract_pdf_fitz.py`, `split_pdf.py`
- [ ] `extracted_pdf_content.txt`, `extracted_pdf_fitz.txt`
- [ ] `code.txt`, `index_old.html`
- [ ] `IELTS_MOCK_TEST_TEMPLATE.json` → nên để trong `/docs` nếu còn cần

#### Tối ưu kỹ thuật
- [ ] Gộp Tailwind config (hiện `teacher_dashboard` và `student_dashboard` có config khác nhau)
- [ ] Tạo `js/utils.js` cho các hàm dùng chung (formatDate, formatScore, redirectByRole...)
- [ ] Mobile responsive: `exam_taker.html` layout 2 cột chưa ổn trên mobile
- [ ] Loading state cho tất cả các query Supabase (hiện chỉ `exam_taker` có spinner)

---

## 📁 Cấu Trúc File Mục Tiêu

```
hannah-english/
├── index.html                  ✅ Landing/redirect
├── auth.html                   ✅ Đăng nhập/đăng ký
├── home.html                   ✅ 
├── teacher_dashboard.html      ✅ → cần kết nối thêm assign HV
├── student_dashboard.html      ⚠️ → cần kết nối Supabase thật
├── exam_taker.html             ✅ → cần kiểm tra flow
├── result_detail.html          ❌ → cần tạo mới (Giai đoạn 3)
├── admin_dashboard.html        ⚠️ → cần hoàn thiện
│
├── js/
│   ├── config.js               ✅ Supabase keys
│   ├── auth_check.js           ✅ Session guard
│   ├── teacher_dashboard.js    ⚠️ → cần thêm assign HV + filter kết quả
│   ├── student_dashboard.js    ❌ → cần viết lại toàn bộ
│   └── utils.js                ❌ → cần tạo (hàm dùng chung)
│
├── supabase_schema.sql         ✅ Schema đầy đủ
├── CAP_NHAT_DATABASE.sql       ✅ Migration file
└── .env.example                ✅
```

---

## 🗄️ Supabase Schema Hiện Tại & Ghi Chú

```
profiles          ✅ Đủ: id, email, full_name, role
courses           ✅ Đủ: id, title, code (ielts/toeic/cambridge)
student_courses   ⚠️ Có nhưng chưa có UI để dùng
exams             ✅ Đủ: questions JSONB, duration, type
exam_results      ✅ Đủ: answers JSONB, score, duration_seconds
```

**Không cần thêm bảng mới** cho Giai đoạn 1-3. Schema hiện tại đã đủ.

---

## ✅ Thứ Tự Làm Việc Đề Xuất

```
Tuần 1:
  [1] Viết lại js/student_dashboard.js (Bước 1.1)
  [2] Cập nhật student_dashboard.html — xóa hardcode, thêm danh sách bài (Bước 1.2)
  [3] Test flow: login học viên → thấy bài → vào làm → nộp → thấy điểm

Tuần 2:
  [4] Thêm UI Assign học viên trong teacher_dashboard (Bước 2.1)
  [5] Tạo result_detail.html (Bước 3.1)
  [6] Nâng cấp panel kết quả teacher (Bước 3.2)

Tuần 3+:
  [7] Fill-in-the-blank nếu cần (Giai đoạn 4)
  [8] Dọn repo + tối ưu (Giai đoạn 5)
```

---

*File này được tạo để làm checklist phát triển. Tích ✅ từng mục khi hoàn thành.*
