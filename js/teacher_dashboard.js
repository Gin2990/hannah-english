/**
 * PHÂN HỆ GIẢNG VIÊN - DỰ ÁN HANNAH ENGLISH (SUPABASE DRIVEN)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Chờ 1s để Session ổn định
    setTimeout(() => {
        if (typeof supabase !== 'undefined' && supabase) {
            initTeacherDashboard();
        }
    }, 1000);
});

async function initTeacherDashboard() {
    console.log("Khởi chạy Bảng điều khiển Giảng viên...");
    
    // 1. Tải danh sách các khóa học để phục vụ việc chọn target
    const courses = await fetchCoursesForTeacher();
    populateCourseDropdown(courses);

    // 2. Tải danh sách kết quả bài làm của học viên online
    await loadStudentAttempts();
    
    // 3. Tự động thêm 1 câu hỏi đầu tiên làm gợi ý soạn thảo
    addNewQuestionCard();
}

// 1. Tải danh sách khóa học từ Supabase
async function fetchCoursesForTeacher() {
    try {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .order('title', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("Lỗi lấy khóa học:", err);
        return [];
    }
}

// 2. Điền danh sách khóa học vào Dropdown
function populateCourseDropdown(courses) {
    const select = document.getElementById('exam-course');
    if (!select) return;
    
    // Giữ lại option mặc định
    select.innerHTML = '<option value="">-- Chọn Khóa Học Target --</option>';
    
    courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        select.appendChild(opt);
    });
}

// 3. Tải và hiển thị bảng kết quả làm bài của học viên trực tuyến
async function loadStudentAttempts() {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-8 text-slate-400 text-xs">
                <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Đang đồng bộ kết quả thi của học viên online...
            </td>
        </tr>
    `;

    try {
        // Thực hiện truy vấn JOIN Supabase để lấy thông tin kết quả bài thi
        const { data: results, error } = await supabase
            .from('exam_results')
            .select(`
                id,
                score,
                total_questions,
                duration_seconds,
                taken_at,
                profiles (
                    full_name,
                    email
                ),
                exams (
                    title
                )
            `)
            .order('taken_at', { ascending: false });

        if (error) throw error;

        if (!results || results.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 text-xs">Chưa có học viên nào làm bài thi online.</td></tr>`;
            return;
        }

        tbody.innerHTML = ""; // Xóa dòng tải

        results.forEach(res => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-surface-container-low transition-colors";

            const studentName = res.profiles?.full_name || "Học viên ẩn danh";
            const studentEmail = res.profiles?.email || "Chưa cập nhật";
            const examTitle = res.exams?.title || "Đề thi đã bị xóa";
            const initials = studentName.split(' ').pop().substring(0, 2).toUpperCase();

            // Tính toán thời gian làm bài
            const minutes = Math.floor(res.duration_seconds / 60);
            const seconds = res.duration_seconds % 60;
            const timeTaken = `${minutes}m ${seconds}s`;

            // Định dạng ngày làm bài
            const dateStr = new Date(res.taken_at).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Tính độ chính xác (%)
            const accuracy = Math.round((res.score / res.total_questions) * 100);
            let scoreColor = "text-green-600";
            if (accuracy < 50) scoreColor = "text-red-500";
            else if (accuracy < 80) scoreColor = "text-amber-500";

            tr.innerHTML = `
                <td class="px-space-lg py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            ${initials}
                        </div>
                        <div>
                            <p class="font-label-md text-label-md text-primary font-bold">${studentName}</p>
                            <p class="text-[11px] text-secondary">${studentEmail}</p>
                        </div>
                    </div>
                </td>
                <td class="px-space-lg py-4 text-xs font-semibold text-slate-700">${examTitle}</td>
                <td class="px-space-lg py-4">
                    <span class="font-bold text-xs ${scoreColor}">${res.score} / ${res.total_questions}</span>
                    <span class="text-[10px] text-slate-400 block">Độ chính xác: ${accuracy}%</span>
                </td>
                <td class="px-space-lg py-4 text-slate-500 text-xs">${timeTaken}</td>
                <td class="px-space-lg py-4 text-slate-500 text-xs text-right">${dateStr}</td>
            `;
            tbody.appendChild(tr);
        });

        // Đồng bộ số lượng học sinh lên stats
        const statTotalStudents = document.querySelector('main section div.grid div:first-child p.text-4xl');
        if (statTotalStudents) {
            // Lấy danh sách email độc nhất
            const uniqueEmails = new Set(results.map(r => r.profiles?.email).filter(Boolean));
            statTotalStudents.textContent = uniqueEmails.size;
        }

    } catch (err) {
        console.error("Lỗi lấy điểm thi:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500 text-xs">Không thể kết nối lấy điểm thi từ Supabase.</td></tr>`;
    }
}

// =========================================================================
// PHẦN B: BỘ DỰNG CÂU HỎI TRỰC QUAN (INTERACTIVE QUESTION BUILDER)
// =========================================================================

let questionIndex = 0;

// 1. Thêm một thẻ câu hỏi soạn thảo mới vào danh sách
function addNewQuestionCard() {
    const listContainer = document.getElementById('questions-builder-list');
    if (!listContainer) return;

    questionIndex++;
    
    const card = document.createElement('div');
    card.className = "q-builder-card p-4 border border-slate-200 rounded-xl bg-white relative space-y-3 shadow-sm transition-all hover:shadow";
    card.id = `q-card-index-${questionIndex}`;
    
    card.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="text-[11px] font-extrabold text-indigo-650 uppercase tracking-wider q-number-label">Câu hỏi ${listContainer.children.length + 1}</span>
            <button type="button" onclick="removeQuestionCard('${card.id}')" class="text-slate-400 hover:text-red-500 transition-colors p-1" title="Xóa câu hỏi">
                <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
        </div>
        
        <input type="text" placeholder="Nhập đề bài câu hỏi tiếng Anh..." class="w-full text-xs border border-slate-250 rounded-lg py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 q-text" required/>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">A</span>
                <input type="text" placeholder="Lựa chọn A..." class="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 q-opt-A" required/>
            </div>
            <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">B</span>
                <input type="text" placeholder="Lựa chọn B..." class="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 q-opt-B" required/>
            </div>
            <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">C</span>
                <input type="text" placeholder="Lựa chọn C..." class="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 q-opt-C" required/>
            </div>
            <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">D</span>
                <input type="text" placeholder="Lựa chọn D..." class="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 q-opt-D" required/>
            </div>
        </div>
        
        <div class="flex items-center gap-2 pt-1 border-t border-slate-100">
            <span class="text-[11px] font-bold text-slate-450 uppercase tracking-wide">Đáp án đúng:</span>
            <select class="text-xs font-bold border border-slate-200 rounded-lg py-1 px-2 text-indigo-700 bg-white focus:ring-indigo-500 q-correct">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
            </select>
        </div>
    `;

    listContainer.appendChild(card);
    updateQuestionsCount();
}

// 2. Xóa một thẻ câu hỏi soạn thảo khỏi danh sách
function removeQuestionCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const listContainer = document.getElementById('questions-builder-list');
    
    // Phải giữ lại tối thiểu 1 câu hỏi
    if (listContainer.children.length <= 1) {
        alert("⚠️ Đề thi cần chứa tối thiểu một câu hỏi!");
        return;
    }

    card.remove();
    
    // Đánh số thứ tự lại các câu hỏi
    Array.from(listContainer.children).forEach((child, index) => {
        const label = child.querySelector('.q-number-label');
        if (label) label.textContent = `Câu hỏi ${index + 1}`;
    });

    updateQuestionsCount();
}

// 3. Cập nhật nhãn số lượng câu hỏi hiện tại
function updateQuestionsCount() {
    const listContainer = document.getElementById('questions-builder-list');
    const label = document.getElementById('questions-count-label');
    if (!listContainer || !label) return;
    
    const count = listContainer.children.length;
    label.textContent = count > 0 ? `${count} câu hỏi đã thêm` : "Chưa có câu hỏi";
}

// 4. Xuất bản đề thi tự soạn trực tuyến
async function publishExamFromBuilder(event) {
    event.preventDefault();
    
    const title = document.getElementById('exam-title').value.trim();
    const courseId = document.getElementById('exam-course').value;
    const duration = parseInt(document.getElementById('exam-duration').value);
    
    if (!title) {
        alert("⚠️ Vui lòng điền tiêu đề đề thi!");
        return;
    }
    if (!courseId) {
        alert("⚠️ Vui lòng chọn Khóa học Target!");
        return;
    }
    if (isNaN(duration) || duration < 5) {
        alert("⚠️ Vui lòng nhập thời gian làm bài hợp lệ (tối thiểu 5 phút)!");
        return;
    }

    // Thu thập dữ liệu câu hỏi tự soạn
    const cardElements = document.querySelectorAll('#questions-builder-list .q-builder-card');
    const questionsArray = [];
    let validationFailed = false;

    cardElements.forEach((card, index) => {
        const questionText = card.querySelector('.q-text').value.trim();
        const optA = card.querySelector('.q-opt-A').value.trim();
        const optB = card.querySelector('.q-opt-B').value.trim();
        const optC = card.querySelector('.q-opt-C').value.trim();
        const optD = card.querySelector('.q-opt-D').value.trim();
        const correctAns = card.querySelector('.q-correct').value;

        if (!questionText || !optA || !optB || !optC || !optD) {
            validationFailed = true;
            card.classList.add('border-red-300', 'bg-red-50/20');
        } else {
            card.classList.remove('border-red-300', 'bg-red-50/20');
            questionsArray.push({
                id: index + 1,
                question: questionText,
                options: [
                    `A. ${optA}`,
                    `B. ${optB}`,
                    `C. ${optC}`,
                    `D. ${optD}`
                ],
                correct: correctAns
            });
        }
    });

    if (validationFailed) {
        alert("⚠️ Có câu hỏi chưa được điền đầy đủ đề bài hoặc các lựa chọn! Vui lòng kiểm tra các ô màu đỏ.");
        return;
    }

    if (questionsArray.length === 0) {
        alert("⚠️ Vui lòng thêm ít nhất một câu hỏi để xuất bản!");
        return;
    }

    // Hiển thị trạng thái đang xử lý trên nút bấm
    const btn = document.getElementById('btn-publish-exam');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> <span>Đang xuất bản...</span>`;

    try {
        const { error } = await supabase
            .from('exams')
            .insert({
                title: title,
                course_id: courseId,
                duration: duration,
                question_count: questionsArray.length,
                questions: questionsArray,
                created_by: window.currentUser.id
            });

        if (error) throw error;

        showToast("Đã xuất bản đề thi online mới thành công!");
        
        // Reset toàn bộ Form
        document.getElementById('exam-title').value = "";
        document.getElementById('exam-course').value = "";
        document.getElementById('exam-duration').value = "15";
        
        const listContainer = document.getElementById('questions-builder-list');
        listContainer.innerHTML = "";
        questionIndex = 0;
        
        // Tạo lại 1 câu hỏi trống gợi ý
        addNewQuestionCard();
        
        // Tải lại danh sách bài nộp gần đây sau 1.5s
        setTimeout(async () => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            window.location.reload();
        }, 1500);

    } catch (err) {
        console.error("Lỗi tạo đề thi online:", err);
        alert("Lỗi khi tạo đề thi: " + err.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Hàm hiển thị Toast thông báo nhanh
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = "fixed top-4 right-4 z-[99999] bg-[#001e40] text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-2 transition-all duration-300";
    toast.innerHTML = `
        <span class="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
