/**
 * LOGIC DANH SÁCH BÀI TẬP & ĐỀ THI - HANNAH ENGLISH
 */

let allExams = [];
let allResults = [];
let assignedCourseIds = [];
let coursesMap = {};

document.addEventListener('DOMContentLoaded', () => {
    // Chờ 1s để Session ổn định
    setTimeout(() => {
        if (typeof supabase !== 'undefined' && supabase) {
            initMyExams();
        }
    }, 1000);
});

async function initMyExams() {
    console.log("Khởi chạy trang bài thi của tôi...");

    if (!window.currentUser) {
        console.warn("Không tìm thấy thông tin học viên tích cực!");
        return;
    }

    try {
        const studentId = window.currentUser.id;

        // 1. Tải các khóa học, phân quyền khóa học và kết quả bài thi song song
        const [coursesRes, studentCoursesRes, resultsRes] = await Promise.all([
            supabase.from('courses').select('*').order('title', { ascending: true }),
            supabase.from('student_courses').select('course_id').eq('student_id', studentId),
            supabase.from('exam_results').select('*').eq('student_id', studentId).order('taken_at', { ascending: false })
        ]);

        if (coursesRes.error) throw coursesRes.error;
        if (studentCoursesRes.error) throw studentCoursesRes.error;
        if (resultsRes.error) throw resultsRes.error;

        const allCourses = coursesRes.data || [];
        assignedCourseIds = (studentCoursesRes.data || []).map(sc => sc.course_id);
        allResults = resultsRes.data || [];

        // Lưu thông tin khóa học để tra cứu tên nhanh
        allCourses.forEach(c => {
            coursesMap[c.id] = c;
        });

        // 2. Điền thông tin vào dropdown bộ lọc khóa học
        populateCourseFilter(allCourses);

        // 3. Tải toàn bộ đề thi thuộc các khóa học đã được phân quyền
        if (assignedCourseIds.length > 0) {
            const { data: exams, error: examsError } = await supabase
                .from('exams')
                .select('*')
                .in('course_id', assignedCourseIds)
                .order('created_at', { ascending: false });

            if (examsError) throw examsError;
            allExams = exams || [];
        } else {
            allExams = [];
        }

        // 4. Kiểm tra xem có tham số course_id trong URL không để lọc tự động
        const urlParams = new URLSearchParams(window.location.search);
        const courseIdParam = urlParams.get('course_id');
        if (courseIdParam && assignedCourseIds.includes(courseIdParam)) {
            const selectCourse = document.getElementById('filter-course');
            if (selectCourse) {
                selectCourse.value = courseIdParam;
            }
        }

        // 5. Tính toán các chỉ số thống kê (Stats Overview)
        calculateStats();

        // 6. Kết xuất danh sách đề thi ra màn hình
        filterAndRenderExams();

        // 7. Gắn sự kiện cho các ô tìm kiếm và bộ lọc
        setupFilterEvents();

    } catch (err) {
        console.error("Lỗi lấy danh sách đề thi:", err);
        const grid = document.getElementById('exams-grid');
        if (grid) {
            grid.innerHTML = `<div class="col-span-full text-center py-10 text-red-500 text-sm">Lỗi kết nối đồng bộ danh sách đề thi.</div>`;
        }
    }
}

// Điền các khóa học vào Dropdown bộ lọc
function populateCourseFilter(courses) {
    const select = document.getElementById('filter-course');
    if (!select) return;

    // Giữ lại option mặc định, chỉ thêm những khóa học được assign
    select.innerHTML = '<option value="all">Tất cả khóa học</option>';
    
    courses.forEach(c => {
        if (assignedCourseIds.includes(c.id)) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.title;
            select.appendChild(opt);
        }
    });
}

// Tính toán các chỉ số thống kê
function calculateStats() {
    const totalEl = document.getElementById('stat-total');
    const completedEl = document.getElementById('stat-completed');
    const pendingEl = document.getElementById('stat-pending');

    if (!totalEl || !completedEl || !pendingEl) return;

    const totalCount = allExams.length;

    // Tính số bài tập đã làm khác biệt (unique exam_ids trong kết quả)
    const completedExamIds = new Set(allResults.map(r => r.exam_id));
    const completedCount = allExams.filter(e => completedExamIds.has(e.id)).length;
    const pendingCount = totalCount - completedCount;

    totalEl.textContent = totalCount;
    completedEl.textContent = completedCount;
    pendingEl.textContent = pendingCount;
}

// Gắn sự kiện lắng nghe bộ lọc
function setupFilterEvents() {
    const searchInput = document.getElementById('search-exam');
    const selectCourse = document.getElementById('filter-course');
    const selectStatus = document.getElementById('filter-status');

    if (searchInput) searchInput.addEventListener('input', filterAndRenderExams);
    if (selectCourse) selectCourse.addEventListener('change', filterAndRenderExams);
    if (selectStatus) selectStatus.addEventListener('change', filterAndRenderExams);
}

// Lọc và render danh sách đề thi
function filterAndRenderExams() {
    const grid = document.getElementById('exams-grid');
    if (!grid) return;

    const query = (document.getElementById('search-exam')?.value || '').toLowerCase().trim();
    const filterCourse = document.getElementById('filter-course')?.value || 'all';
    const filterStatus = document.getElementById('filter-status')?.value || 'all';

    // Lọc danh sách đề thi dựa trên bộ lọc
    const filtered = allExams.filter(exam => {
        // 1. Lọc theo từ khóa tìm kiếm
        const matchesQuery = exam.title.toLowerCase().includes(query);

        // 2. Lọc theo khóa học
        const matchesCourse = filterCourse === 'all' || exam.course_id === filterCourse;

        // 3. Lọc theo trạng thái làm bài
        const hasResult = allResults.some(r => r.exam_id === exam.id);
        const matchesStatus = filterStatus === 'all' || 
            (filterStatus === 'completed' && hasResult) || 
            (filterStatus === 'pending' && !hasResult);

        return matchesQuery && matchesCourse && matchesStatus;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-20 text-slate-400 text-sm">
                <span class="material-symbols-outlined text-4xl block mb-2">sentiment_dissatisfied</span>
                Không tìm thấy bài tập nào phù hợp với bộ lọc hiện tại.
            </div>
        `;
        return;
    }

    grid.innerHTML = "";

    filtered.forEach(exam => {
        // Lấy kết quả làm bài gần nhất của đề thi này
        const examResults = allResults.filter(r => r.exam_id === exam.id);
        const hasBeenTaken = examResults.length > 0;
        const lastResult = hasBeenTaken ? examResults[0] : null;

        const course = coursesMap[exam.course_id] || { title: 'Khóa học khác' };

        const card = document.createElement('div');
        card.className = "exam-card-bg p-space-lg border border-outline-variant rounded-xl hover:border-primary hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[200px]";

        let statusBadge = "";
        let actionButtons = "";

        if (hasBeenTaken) {
            // Đã làm
            const accuracy = Math.round((lastResult.score / lastResult.total_questions) * 100);
            statusBadge = `
                <div class="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">
                    <span class="material-symbols-outlined text-xs">check_circle</span>
                    Đã làm (${accuracy}%)
                </div>
            `;
            actionButtons = `
                <div class="flex items-center justify-between w-full pt-4 border-t border-slate-100 mt-4 gap-2">
                    <a href="result_detail.html?result_id=${lastResult.id}" class="text-xs text-primary font-bold hover:underline flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">assignment</span> Xem kết quả
                    </a>
                    <button onclick="startExam('${exam.id}')" class="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 font-bold hover:bg-primary hover:text-white rounded-lg text-xs transition-all flex items-center gap-0.5">
                        Làm lại <span class="material-symbols-outlined text-xs">restart_alt</span>
                    </button>
                </div>
            `;
        } else {
            // Chưa làm
            statusBadge = `
                <div class="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">
                    <span class="material-symbols-outlined text-xs">pending</span>
                    Chưa làm
                </div>
            `;
            actionButtons = `
                <div class="w-full pt-4 border-t border-slate-100 mt-4">
                    <button onclick="startExam('${exam.id}')" class="w-full py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-lg text-xs uppercase tracking-wide transition-all shadow-sm flex items-center justify-center gap-1">
                        Bắt đầu làm bài <span class="material-symbols-outlined text-xs">arrow_forward</span>
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-3">
                    <span class="text-[10px] bg-slate-100 border border-slate-250 text-slate-600 px-2 py-0.5 rounded font-bold uppercase truncate max-w-[150px]">${course.title.split(' ')[0]}</span>
                    ${statusBadge}
                </div>
                <h3 class="font-bold text-primary text-sm line-clamp-2 mb-2 pt-1" title="${exam.title}">${exam.title}</h3>
                <div class="flex gap-4 text-xs font-semibold text-slate-400">
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">timer</span> ${exam.duration} phút</span>
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">quiz</span> ${exam.question_count} câu hỏi</span>
                </div>
            </div>
            ${actionButtons}
        `;

        grid.appendChild(card);
    });
}

// Chuyển tới phòng thi
function startExam(examId) {
    if (confirm("🔔 Bạn đã sẵn sàng bắt đầu bài thi thử này chưa?\nĐồng hồ đếm ngược sẽ chạy ngay khi bạn vào phòng thi.")) {
        window.location.href = `exam_taker.html?id=${examId}`;
    }
}
