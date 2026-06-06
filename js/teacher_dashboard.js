/**
 * PHÂN HỆ GIẢNG VIÊN - DỰ ÁN HANNAH ENGLISH (SUPABASE DRIVEN)
 */

let systemCourses = [];
let allAttempts = [];
let allStudents = [];
let questionIndex = 0;

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
    systemCourses = await fetchCoursesForTeacher();
    populateCourseDropdown(systemCourses);

    // 2. Tải danh sách kết quả bài làm của học viên online
    await loadStudentAttempts();
    
    // 3. Tải danh sách học viên và phân quyền khóa học
    await loadStudentsPermissions();
    
    // 4. Cấu hình điều hướng Tab giữa Bảng điều khiển và Quản lý học viên
    setupTeacherTabNavigation();

    // 5. Thiết lập sự kiện tìm kiếm & lọc trên bảng hiệu suất
    setupPerformanceFilters();

    // 6. Tự động thêm 1 câu hỏi đầu tiên làm gợi ý soạn thảo
    addNewQuestionCard();
}

// =========================================================================
// PHẦN A: ĐIỀU HƯỚNG TAB ĐỘNG (SPA NAVIGATION)
// =========================================================================
function setupTeacherTabNavigation() {
    const btnDashboard = document.getElementById('tab-btn-dashboard');
    const btnStudents = document.getElementById('tab-btn-students');

    const viewDashboard = document.getElementById('view-dashboard');
    const viewStudents = document.getElementById('view-students');

    if (!btnDashboard || !btnStudents || !viewDashboard || !viewStudents) return;

    btnDashboard.onclick = (e) => {
        e.preventDefault();
        // Cập nhật trạng thái nút
        btnDashboard.className = "flex items-center gap-space-md px-space-md py-space-sm rounded-lg sidebar-active transition-all cursor-pointer";
        btnStudents.className = "flex items-center gap-space-md px-space-md py-space-sm rounded-lg text-secondary hover:bg-surface-container hover:text-primary transition-all cursor-pointer";
        
        // Ẩn/Hiện view
        viewDashboard.classList.remove('hidden');
        viewStudents.classList.add('hidden');
    };

    btnStudents.onclick = (e) => {
        e.preventDefault();
        // Cập nhật trạng thái nút
        btnStudents.className = "flex items-center gap-space-md px-space-md py-space-sm rounded-lg sidebar-active transition-all cursor-pointer";
        btnDashboard.className = "flex items-center gap-space-md px-space-md py-space-sm rounded-lg text-secondary hover:bg-surface-container hover:text-primary transition-all cursor-pointer";

        // Ẩn/Hiện view
        viewStudents.classList.remove('hidden');
        viewDashboard.classList.add('hidden');
        
        // Load lại danh sách phân quyền học viên
        loadStudentsPermissions();
    };
}

// =========================================================================
// PHẦN B: QUẢN LÝ PHÂN QUYỀN HỌC VIÊN (STUDENT ASSIGNMENTS)
// =========================================================================
async function loadStudentsPermissions() {
    const tbody = document.getElementById('student-permissions-tbody');
    const searchInput = document.getElementById('search-student-permission');
    if (!tbody) return;

    try {
        // Lấy tất cả profiles có vai trò học viên
        const { data: students, error: errStudents } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student')
            .order('full_name', { ascending: true });

        if (errStudents) throw errStudents;
        allStudents = students || [];

        // Lấy toàn bộ bảng student_courses
        const { data: enrollments, error: errEnrollments } = await supabase
            .from('student_courses')
            .select('*');

        if (errEnrollments) throw errEnrollments;

        renderPermissionsTable(allStudents, enrollments);

        // Sự kiện tìm kiếm học viên phân quyền
        if (searchInput) {
            searchInput.oninput = () => {
                const query = searchInput.value.toLowerCase().trim();
                const filtered = allStudents.filter(s => 
                    (s.full_name || '').toLowerCase().includes(query) || 
                    (s.email || '').toLowerCase().includes(query)
                );
                renderPermissionsTable(filtered, enrollments);
            };
        }

    } catch (err) {
        console.error("Lỗi lấy danh sách học viên & phân quyền:", err);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-red-500 text-xs">Lỗi lấy dữ liệu phân quyền từ Supabase.</td></tr>`;
    }
}

function renderPermissionsTable(students, enrollments) {
    const tbody = document.getElementById('student-permissions-tbody');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-slate-400 text-xs">Không tìm thấy học viên nào.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    students.forEach(student => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-surface-container-low transition-colors";

        const initials = (student.full_name || 'H').split(' ').pop().substring(0, 2).toUpperCase();
        
        // Tìm các khóa học học viên đã gán
        const assignedIds = enrollments
            .filter(e => e.student_id === student.id)
            .map(e => e.course_id);

        // Tạo checkbox cho từng khóa học
        let checkboxesHtml = "";
        systemCourses.forEach(c => {
            const isChecked = assignedIds.includes(c.id) ? 'checked' : '';
            checkboxesHtml += `
                <label class="inline-flex items-center gap-1.5 mr-4 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded text-xs select-none cursor-pointer hover:bg-slate-100 transition-all">
                    <input type="checkbox" 
                           class="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5" 
                           ${isChecked} 
                           onchange="toggleCoursePermission('${student.id}', '${c.id}', this)"/>
                    <span class="font-medium text-slate-700">${c.title}</span>
                </label>
            `;
        });

        tr.innerHTML = `
            <td class="px-space-lg py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-label-md text-label-md text-primary font-bold">${student.full_name || 'Học viên mới'}</p>
                        <p class="text-[11px] text-secondary">${student.email}</p>
                    </div>
                </div>
            </td>
            <td class="px-space-lg py-4">
                <div class="flex flex-wrap gap-2">
                    ${checkboxesHtml}
                </div>
            </td>
            <td class="px-space-lg py-4 text-right">
                <span class="flex items-center justify-end gap-1.5 text-xs text-green-600 font-semibold">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span> Đang học
                </span>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

// Bật/Tắt phân quyền khóa học cho học viên
async function toggleCoursePermission(studentId, courseId, checkbox) {
    const isChecked = checkbox.checked;
    
    try {
        if (isChecked) {
            // Thêm phân quyền
            const { error } = await supabase
                .from('student_courses')
                .insert({
                    student_id: studentId,
                    course_id: courseId
                });
            if (error) throw error;
            showToast("Đã cấp quyền truy cập khóa học thành công!");
        } else {
            // Hủy phân quyền
            const { error } = await supabase
                .from('student_courses')
                .delete()
                .eq('student_id', studentId)
                .eq('course_id', courseId);
            if (error) throw error;
            showToast("Đã gỡ quyền truy cập khóa học thành công!");
        }
    } catch (err) {
        console.error("Lỗi cập nhật quyền khóa học:", err);
        alert("Không thể cập nhật quyền khóa học: " + err.message);
        checkbox.checked = !isChecked; // Trả lại trạng thái cũ
    }
}

// =========================================================================
// PHẦN C: HIỆU SUẤT SINH VIÊN (STUDENT ATTEMPTS / PERFORMANCE)
// =========================================================================
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

function populateCourseDropdown(courses) {
    const select = document.getElementById('exam-course');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Chọn Khóa Học Target --</option>';
    courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        select.appendChild(opt);
    });
}

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
                    id,
                    title
                )
            `)
            .order('taken_at', { ascending: false });

        if (error) throw error;
        allAttempts = results || [];

        // 1. Cập nhật danh sách đề thi vào bộ lọc filter-exam-performance
        populateExamFilter(allAttempts);

        // 2. Render bảng hiệu suất học viên
        filterAndRenderPerformance();

        // 3. Đồng bộ thống kê (Stats Cards)
        updatePerformanceStats();

    } catch (err) {
        console.error("Lỗi lấy điểm thi:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500 text-xs">Không thể kết nối lấy điểm thi từ Supabase.</td></tr>`;
    }
}

function populateExamFilter(attempts) {
    const select = document.getElementById('filter-exam-performance');
    if (!select) return;

    // Lọc danh sách đề thi duy nhất
    const examsSeen = new Set();
    const uniqueExams = [];

    attempts.forEach(att => {
        if (att.exams && !examsSeen.has(att.exams.id)) {
            examsSeen.add(att.exams.id);
            uniqueExams.push(att.exams);
        }
    });

    select.innerHTML = '<option value="all">Tất cả đề thi</option>';
    uniqueExams.forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.textContent = ex.title;
        select.appendChild(opt);
    });
}

function setupPerformanceFilters() {
    const searchInput = document.getElementById('search-student-performance');
    const examFilter = document.getElementById('filter-exam-performance');
    const sortFilter = document.getElementById('sort-performance');

    if (searchInput) searchInput.addEventListener('input', filterAndRenderPerformance);
    if (examFilter) examFilter.addEventListener('change', filterAndRenderPerformance);
    if (sortFilter) sortFilter.addEventListener('change', filterAndRenderPerformance);
}

function filterAndRenderPerformance() {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    const query = (document.getElementById('search-student-performance')?.value || '').toLowerCase().trim();
    const filterExam = document.getElementById('filter-exam-performance')?.value || 'all';
    const sortBy = document.getElementById('sort-performance')?.value || 'newest';

    // 1. Lọc kết quả
    let filtered = allAttempts.filter(att => {
        const studentName = (att.profiles?.full_name || '').toLowerCase();
        const studentEmail = (att.profiles?.email || '').toLowerCase();
        const matchesQuery = studentName.includes(query) || studentEmail.includes(query);

        const matchesExam = filterExam === 'all' || (att.exams && att.exams.id === filterExam);

        return matchesQuery && matchesExam;
    });

    // 2. Sắp xếp kết quả
    if (sortBy === 'newest') {
        filtered.sort((a, b) => new Date(b.taken_at) - new Date(a.taken_at));
    } else if (sortBy === 'highest') {
        filtered.sort((a, b) => (b.score / b.total_questions) - (a.score / a.total_questions));
    } else if (sortBy === 'lowest') {
        filtered.sort((a, b) => (a.score / a.total_questions) - (b.score / b.total_questions));
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 text-xs">Không tìm thấy kết quả làm bài nào.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    filtered.forEach(res => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-surface-container-low transition-colors border-b border-slate-100";

        const studentName = res.profiles?.full_name || "Học viên ẩn danh";
        const studentEmail = res.profiles?.email || "Chưa cập nhật";
        const examTitle = res.exams?.title || "Đề thi đã bị xóa";
        const initials = studentName.split(' ').pop().substring(0, 2).toUpperCase();

        const minutes = Math.floor(res.duration_seconds / 60);
        const seconds = res.duration_seconds % 60;
        const timeTaken = `${minutes}p ${seconds}s`;

        const dateStr = new Date(res.taken_at).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const accuracy = Math.round((res.score / res.total_questions) * 100);
        let scoreColor = "text-green-600";
        if (accuracy < 50) scoreColor = "text-red-500";
        else if (accuracy < 80) scoreColor = "text-amber-500";

        tr.innerHTML = `
            <td class="px-space-lg py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-label-md text-label-md text-primary font-bold">${studentName}</p>
                        <p class="text-[11px] text-secondary">${studentEmail}</p>
                    </div>
                </div>
            </td>
            <td class="px-space-lg py-4 text-xs font-semibold text-slate-700 max-w-[200px] truncate" title="${examTitle}">${examTitle}</td>
            <td class="px-space-lg py-4">
                <span class="font-bold text-xs ${scoreColor}">${res.score} / ${res.total_questions}</span>
                <span class="text-[10px] text-slate-400 block">Chính xác: ${accuracy}%</span>
            </td>
            <td class="px-space-lg py-4 text-slate-500 text-xs">${timeTaken}</td>
            <td class="px-space-lg py-4 text-right">
                <div class="flex flex-col items-end gap-1">
                    <span class="text-[10px] text-slate-400">${dateStr}</span>
                    <a href="result_detail.html?result_id=${res.id}" class="text-xs text-primary font-bold hover:underline flex items-center gap-0.5">
                        Xem chi tiết <span class="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Cập nhật nhãn phân trang/đếm
    const countText = document.querySelector('section p.text-slate-500');
    if (countText) {
        countText.textContent = `Hiển thị ${filtered.length} trên tổng số ${allAttempts.length} lượt nộp bài`;
    }
}

// Cập nhật thống kê stats từ kết quả
function updatePerformanceStats() {
    // Tổng số sinh viên
    const statTotalStudents = document.querySelector('main section div.grid div:first-child p.text-4xl');
    if (statTotalStudents) {
        const uniqueStudentIds = new Set(allAttempts.map(r => r.profiles?.email).filter(Boolean));
        statTotalStudents.textContent = uniqueStudentIds.size;
    }

    // Điểm trung bình hệ thống (độ chính xác trung bình quy ra thang 10)
    const statAvgScore = document.querySelector('main section div.grid div:nth-child(2) p.text-4xl');
    if (statAvgScore && allAttempts.length > 0) {
        let totalAccuracy = 0;
        allAttempts.forEach(att => {
            totalAccuracy += (att.score / att.total_questions);
        });
        const avg = ((totalAccuracy / allAttempts.length) * 10).toFixed(1);
        statAvgScore.textContent = avg;
    }
}

// =========================================================================
// PHẦN D: BỘ SOẠN THẢO ĐỀ THI TRỰC QUAN (INTERACTIVE QUESTION BUILDER)
// =========================================================================

// Thêm thẻ câu hỏi soạn thảo mới vào danh sách
function addNewQuestionCard() {
    const listContainer = document.getElementById('questions-builder-list');
    if (!listContainer) return;

    questionIndex++;
    
    const card = document.createElement('div');
    card.className = "q-builder-card p-4 border border-slate-200 rounded-xl bg-white relative space-y-3 shadow-sm transition-all hover:shadow";
    card.id = `q-card-index-${questionIndex}`;
    
    card.innerHTML = `
        <div class="flex justify-between items-center pb-2 border-b border-slate-100">
            <span class="text-[11px] font-extrabold text-indigo-650 uppercase tracking-wider q-number-label">Câu hỏi ${listContainer.children.length + 1}</span>
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-slate-450 font-bold uppercase">Loại:</span>
                <select class="text-[10px] font-bold border border-slate-200 rounded py-0.5 px-1 bg-white text-slate-700 q-type" onchange="toggleQuestionType(this)">
                    <option value="multiple_choice">Trắc nghiệm</option>
                    <option value="fill_in_blank">Điền từ</option>
                </select>
                <button type="button" onclick="removeQuestionCard('${card.id}')" class="text-slate-400 hover:text-red-500 transition-colors p-1" title="Xóa câu hỏi">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
            </div>
        </div>
        
        <input type="text" placeholder="Nhập đề bài câu hỏi tiếng Anh... (Dùng ___ cho điền từ)" class="w-full text-xs border border-slate-250 rounded-lg py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 q-text" required/>
        
        <!-- Grid trắc nghiệm -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 q-options-grid">
            <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">A</span>
                <input type="text" placeholder="Lựa chọn A..." class="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 q-opt-A"/>
            </div>
            <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">B</span>
                <input type="text" placeholder="Lựa chọn B..." class="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 q-opt-B"/>
            </div>
            <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">C</span>
                <input type="text" placeholder="Lựa chọn C..." class="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 q-opt-C"/>
            </div>
            <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">D</span>
                <input type="text" placeholder="Lựa chọn D..." class="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 q-opt-D"/>
            </div>
        </div>
        
        <!-- Đúng trắc nghiệm -->
        <div class="flex items-center gap-2 pt-1 border-t border-slate-100 q-correct-wrapper">
            <span class="text-[11px] font-bold text-slate-450 uppercase tracking-wide">Đáp án đúng:</span>
            <select class="text-xs font-bold border border-slate-200 rounded-lg py-1 px-2 text-indigo-750 bg-white focus:ring-indigo-500 q-correct">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
            </select>
        </div>

        <!-- Đúng điền từ -->
        <div class="hidden space-y-2 pt-1 border-t border-slate-100 q-fib-wrapper">
            <div class="flex items-center gap-2">
                <span class="text-[11px] font-bold text-slate-450 uppercase tracking-wide">Đáp án đúng:</span>
                <input type="text" placeholder="Đáp án đúng (Ví dụ: apple)..." class="text-xs border border-slate-200 rounded-lg py-1 px-3 focus:ring-indigo-500 text-indigo-700 font-bold q-fib-correct w-48"/>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[11px] font-bold text-slate-450 uppercase tracking-wide">Biến thể chấp nhận (phân cách bằng dấu phẩy):</span>
                <input type="text" placeholder="Ví dụ: apples, an apple" class="text-xs border border-slate-200 rounded-lg py-1 px-3 focus:ring-indigo-500 text-slate-650 q-fib-variants flex-1"/>
            </div>
        </div>
    `;

    listContainer.appendChild(card);
    updateQuestionsCount();
}

function toggleQuestionType(selectEl) {
    const card = selectEl.closest('.q-builder-card');
    const optionsGrid = card.querySelector('.q-options-grid');
    const correctWrapper = card.querySelector('.q-correct-wrapper');
    const fibWrapper = card.querySelector('.q-fib-wrapper');

    if (selectEl.value === 'fill_in_blank') {
        optionsGrid.classList.add('hidden');
        correctWrapper.classList.add('hidden');
        fibWrapper.classList.remove('hidden');
    } else {
        optionsGrid.classList.remove('hidden');
        correctWrapper.classList.remove('hidden');
        fibWrapper.classList.add('hidden');
    }
}

// Xóa một thẻ câu hỏi soạn thảo khỏi danh sách
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

// Cập nhật nhãn số lượng câu hỏi hiện tại
function updateQuestionsCount() {
    const listContainer = document.getElementById('questions-builder-list');
    const label = document.getElementById('questions-count-label');
    if (!listContainer || !label) return;
    
    const count = listContainer.children.length;
    label.textContent = count > 0 ? `${count} câu hỏi đã thêm` : "Chưa có câu hỏi";
}

// Xuất bản đề thi tự soạn trực tuyến
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

    const cardElements = document.querySelectorAll('#questions-builder-list .q-builder-card');
    const questionsArray = [];
    let validationFailed = false;

    cardElements.forEach((card, index) => {
        const questionText = card.querySelector('.q-text').value.trim();
        const type = card.querySelector('.q-type').value;

        if (!questionText) {
            validationFailed = true;
            card.classList.add('border-red-300', 'bg-red-50/20');
            return;
        }

        if (type === 'fill_in_blank') {
            const correctAns = card.querySelector('.q-fib-correct').value.trim();
            const variantsText = card.querySelector('.q-fib-variants').value.trim();
            const acceptVariants = variantsText ? variantsText.split(',').map(v => v.trim()) : [];

            if (!correctAns) {
                validationFailed = true;
                card.classList.add('border-red-300', 'bg-red-50/20');
            } else {
                card.classList.remove('border-red-300', 'bg-red-50/20');
                questionsArray.push({
                    id: index + 1,
                    type: 'fill_in_blank',
                    question: questionText,
                    correct: correctAns,
                    accept_variants: acceptVariants
                });
            }
        } else {
            // Trắc nghiệm
            const optA = card.querySelector('.q-opt-A').value.trim();
            const optB = card.querySelector('.q-opt-B').value.trim();
            const optC = card.querySelector('.q-opt-C').value.trim();
            const optD = card.querySelector('.q-opt-D').value.trim();
            const correctAns = card.querySelector('.q-correct').value;

            if (!optA || !optB || !optC || !optD) {
                validationFailed = true;
                card.classList.add('border-red-300', 'bg-red-50/20');
            } else {
                card.classList.remove('border-red-300', 'bg-red-50/20');
                questionsArray.push({
                    id: index + 1,
                    type: 'multiple_choice',
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
        }
    });

    if (validationFailed) {
        alert("⚠️ Có câu hỏi chưa được điền đầy đủ đề bài hoặc các lựa chọn/đáp án! Vui lòng kiểm tra các ô màu đỏ.");
        return;
    }

    if (questionsArray.length === 0) {
        alert("⚠️ Vui lòng thêm ít nhất một câu hỏi để xuất bản!");
        return;
    }

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
        
        addNewQuestionCard();
        
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

// Hiển thị Toast thông báo nhanh
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
