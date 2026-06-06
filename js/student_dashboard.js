/**
 * PHÂN HỆ HỌC VIÊN - DỰ ÁN HANNAH ENGLISH (SUPABASE DRIVEN)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Chờ 1s để Session ổn định
    setTimeout(() => {
        if (typeof supabase !== 'undefined' && supabase) {
            initStudentDashboard();
        }
    }, 1000);
});

async function initStudentDashboard() {
    console.log("Khởi chạy Bảng điều khiển Học viên...");

    if (!window.currentUser) {
        console.warn("Không tìm thấy thông tin học viên tích cực!");
        return;
    }

    try {
        // 1. Tải toàn bộ dữ liệu cần thiết từ Supabase song song
        const studentId = window.currentUser.id;

        const [coursesRes, studentCoursesRes, examsRes, resultsRes] = await Promise.all([
            supabase.from('courses').select('*').order('title', { ascending: true }),
            supabase.from('student_courses').select('course_id').eq('student_id', studentId),
            supabase.from('exams').select('id, course_id'),
            supabase.from('exam_results').select('id, exam_id, score, total_questions, taken_at').eq('student_id', studentId)
        ]);

        if (coursesRes.error) throw coursesRes.error;
        if (studentCoursesRes.error) throw studentCoursesRes.error;
        if (examsRes.error) throw examsRes.error;
        if (resultsRes.error) throw resultsRes.error;

        const allCourses = coursesRes.data || [];
        const allowedCourseIds = (studentCoursesRes.data || []).map(sc => sc.course_id);
        const allExams = examsRes.data || [];
        const allResults = resultsRes.data || [];

        // 2. Cập nhật giao diện khóa học động
        renderCourseCards(allCourses, allowedCourseIds, allExams, allResults);

        // 3. Cập nhật câu chào mừng và tiến độ tổng quát
        updateWelcomeHeader(allExams, allResults);

        // 4. Tải lịch sử điểm và liên kết xem lại
        renderGradeHistory(allResults);

    } catch (err) {
        console.error("Lỗi khởi tạo dashboard học viên:", err);
    }
}

// Cập nhật câu chào mừng và thống kê nhanh
function updateWelcomeHeader(allExams, allResults) {
    const welcomeSub = document.querySelector('main section p');
    if (!welcomeSub) return;

    const totalExams = allExams.length;
    const completedExams = new Set(allResults.map(r => r.exam_id)).size;

    if (totalExams > 0) {
        const percent = Math.round((completedExams / totalExams) * 100);
        welcomeSub.textContent = `Bạn đã hoàn thành ${completedExams}/${totalExams} bài tập (${percent}%). Hãy tiếp tục cố gắng nhé!`;
    } else {
        welcomeSub.textContent = `Chào mừng bạn đến với Hannah English. Hãy bắt đầu hành trình học tập của bạn!`;
    }
}

// Kết xuất các thẻ khóa học động
function renderCourseCards(courses, allowedIds, exams, results) {
    const container = document.getElementById('course-cards-container');
    if (!container) return;

    if (courses.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-6 text-slate-400 italic">Chưa có khóa học nào được cấu hình trên hệ thống.</div>`;
        return;
    }

    container.innerHTML = "";

    // Định nghĩa các icon và badge tương ứng cho từng loại mã code
    const courseMeta = {
        ielts: { icon: 'menu_book', badge: 'Academic', color: 'bg-primary-fixed text-on-primary-fixed' },
        toeic: { icon: 'business_center', badge: 'Professional', color: 'bg-secondary-container text-on-secondary-container' },
        cambridge: { icon: 'workspace_premium', badge: 'Certificate', color: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' }
    };

    courses.forEach(c => {
        const codeLower = (c.code || '').toLowerCase();
        const meta = courseMeta[codeLower] || { icon: 'school', badge: 'General', color: 'bg-slate-100 text-slate-700' };
        const isAllowed = allowedIds.includes(c.id);

        // Lọc bài tập của khóa học này
        const courseExams = exams.filter(e => e.course_id === c.id);
        const totalExams = courseExams.length;

        // Lọc bài tập đã làm
        const courseExamIds = courseExams.map(e => e.id);
        const completedExams = new Set(results.filter(r => courseExamIds.includes(r.exam_id)).map(r => r.exam_id)).size;

        const progressPercent = totalExams > 0 ? Math.round((completedExams / totalExams) * 100) : 0;

        const card = document.createElement('div');
        card.className = "course-card-bg p-space-lg border border-outline-variant rounded-xl hover:border-primary transition-all duration-300 relative group flex flex-col justify-between min-h-[200px]";

        if (!isAllowed) {
            // Thẻ bị khóa
            card.classList.add('opacity-50', 'grayscale');
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-space-md">
                        <div class="w-14 h-14 bg-surface-container-high rounded-xl flex items-center justify-center text-primary border border-outline-variant">
                            <span class="material-symbols-outlined text-4xl">${meta.icon}</span>
                        </div>
                        <span class="${meta.color} text-[10px] font-bold px-2 py-1 rounded uppercase">${meta.badge}</span>
                    </div>
                    <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-primary mb-1">${c.title}</h3>
                    <p class="font-body-md text-body-md text-secondary mb-space-lg">${c.description || 'Chưa có mô tả chi tiết cho khóa học này.'}</p>
                </div>
                
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/10 backdrop-filter backdrop-blur-[1px] rounded-xl text-[#0b1623] font-bold text-xs gap-1 select-none pointer-events-none">
                    <span class="material-symbols-outlined text-3xl text-red-600" style="font-variation-settings: 'FILL' 1;">lock</span>
                    <span class="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px]">Chưa cấp quyền</span>
                </div>
            `;

            card.style.cursor = "pointer";
            card.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                alert(`🔒 Khóa học "${c.title}" chưa được phân quyền cho bạn!\nVui lòng liên hệ Admin hoặc Giáo viên để đăng ký khóa học.`);
            };
        } else {
            // Thẻ đã mở khóa
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-space-md">
                        <div class="w-14 h-14 bg-surface-container-high rounded-xl flex items-center justify-center text-primary border border-outline-variant">
                            <span class="material-symbols-outlined text-4xl">${meta.icon}</span>
                        </div>
                        <span class="${meta.color} text-[10px] font-bold px-2 py-1 rounded uppercase">${meta.badge}</span>
                    </div>
                    <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-primary mb-1 group-hover:text-primary-container transition-colors">${c.title}</h3>
                    <p class="font-body-md text-body-md text-secondary mb-space-lg line-clamp-2">${c.description || 'Chưa có mô tả chi tiết cho khóa học này.'}</p>
                </div>
                <div class="space-y-2 mt-auto">
                    <div class="flex justify-between text-label-sm font-label-sm text-secondary">
                        <span>Tiến độ bài tập</span>
                        <span>${progressPercent}% (${completedExams}/${totalExams})</span>
                    </div>
                    <div class="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div class="h-full bg-primary rounded-full transition-all duration-1000" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            `;

            card.style.cursor = "pointer";
            card.onclick = () => {
                // Chuyển hướng sang danh sách đề thi lọc theo khóa học
                window.location.href = `my_exams.html?course_id=${c.id}`;
            };
        }

        container.appendChild(card);
    });

    // Kích hoạt lại micro-animation của tiến độ
    setTimeout(() => {
        const progressBars = container.querySelectorAll('.h-full.bg-primary');
        progressBars.forEach(bar => {
            const width = bar.style.width;
            bar.style.width = '0';
            setTimeout(() => {
                bar.style.width = width;
            }, 100);
        });
    }, 200);
}

// Kết xuất lịch sử điểm số của học viên
async function renderGradeHistory(results) {
    const listContainer = document.querySelector('main aside div.space-y-space-md');
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (results.length === 0) {
        listContainer.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center">Bạn chưa có bài thi đã làm nào.</p>`;
        return;
    }

    // Lấy 4 kết quả làm bài gần đây nhất
    const recentResults = results.slice(0, 4);

    // Lấy tên đề thi của các bài làm này
    const examIds = recentResults.map(r => r.exam_id);
    let examsMap = {};
    if (examIds.length > 0) {
        const { data: exams, error } = await supabase
            .from('exams')
            .select('id, title')
            .in('id', examIds);
        if (!error && exams) {
            exams.forEach(e => {
                examsMap[e.id] = e.title;
            });
        }
    }

    recentResults.forEach(res => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-space-md border-b border-surface-container pb-space-md last:border-0 last:pb-0";

        const examTitle = examsMap[res.exam_id] || "Đề thi đã xóa";
        const accuracy = Math.round((res.score / res.total_questions) * 100);
        const dateStr = new Date(res.taken_at).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        item.innerHTML = `
            <div class="w-10 h-10 bg-primary-fixed text-primary rounded-lg flex items-center justify-center font-bold text-xs shrink-0" title="Độ chính xác">
                ${accuracy}%
            </div>
            <div class="flex-grow min-w-0">
                <h4 class="font-label-md text-label-md text-on-surface font-bold truncate" title="${examTitle}">${examTitle}</h4>
                <p class="font-label-sm text-[11px] text-slate-400">Đúng ${res.score}/${res.total_questions} • ${dateStr}</p>
            </div>
            <a href="result_detail.html?result_id=${res.id}" class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-colors flex items-center" title="Xem kết quả chi tiết">
                <span class="material-symbols-outlined text-sm">chevron_right</span>
            </a>
        `;
        listContainer.appendChild(item);
    });
}
