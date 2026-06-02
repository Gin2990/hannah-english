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

    // 1. Lấy thông tin các khóa học được phân quyền từ Supabase
    const allowedCourseCodes = await fetchAllowedCourses(window.currentUser.id);
    
    // 2. Cập nhật giao diện Khóa học của tôi (Khóa nào chưa cấp quyền sẽ hiển thị Lock)
    enforceCoursePermissions(allowedCourseCodes);

    // 3. Tải Lịch học & Hoạt động gần đây cá nhân nếu có
    loadStudentActivity();
}

// 1. Truy vấn các khóa học đã được phân quyền online
async function fetchAllowedCourses(studentId) {
    try {
        const { data, error } = await supabase
            .from('student_courses')
            .select(`
                course_id,
                courses (
                    code
                )
            `)
            .eq('student_id', studentId);

        if (error) throw error;

        // Trích xuất mã code viết thường
        const codes = data.map(item => item.courses?.code?.toLowerCase()).filter(Boolean);
        console.log("Khóa học được phân quyền online:", codes);
        return codes;
    } catch (err) {
        console.error("Lỗi lấy phân quyền học viên:", err);
        // Fallback: Nếu lỗi kết nối, cho phép truy cập TOEIC làm mặc định để học thử
        return ['toeic'];
    }
}

// 2. Áp dụng hiệu ứng Lock / Mở khóa cho các thẻ khóa học
function enforceCoursePermissions(allowedCodes) {
    // Tìm các thẻ khóa học trong giao diện
    const courseCards = document.querySelectorAll('.course-card-bg');
    
    courseCards.forEach(card => {
        const titleEl = card.querySelector('h3');
        if (!titleEl) return;

        const titleText = titleEl.textContent.toLowerCase();
        let courseCode = "";

        if (titleText.includes("ielts")) courseCode = "ielts";
        else if (titleText.includes("toeic")) courseCode = "toeic";
        else if (titleText.includes("cambridge")) courseCode = "cambridge";

        const isAllowed = allowedCodes.includes(courseCode);

        // Nút hành động hoặc link của card
        const continueBtn = card.querySelector('button') || card;

        if (!isAllowed) {
            // Thiết kế trạng thái Bị Khóa (Locked Card UI)
            card.classList.add('opacity-50', 'grayscale', 'relative');
            
            // Chèn biểu tượng khóa bảo mật ở góc
            const lockBadge = document.createElement('div');
            lockBadge.className = "absolute inset-0 flex flex-col items-center justify-center bg-slate-900/10 backdrop-filter backdrop-blur-[1px] rounded-xl text-[#0b1623] font-bold text-xs gap-1 select-none pointer-events-none";
            lockBadge.innerHTML = `
                <span class="material-symbols-outlined text-3xl text-red-600" style="font-variation-settings: 'FILL' 1;">lock</span>
                <span class="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px]">Chưa cấp quyền</span>
            `;
            card.appendChild(lockBadge);

            // Gỡ bỏ hành động click
            card.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                alert("🔒 Khóa học này chưa được phân quyền cho bạn!\nVui lòng liên hệ Giáo viên hoặc Admin để đăng ký khóa học.");
            };
        } else {
            // Mở khóa -> Click để chuyển tới trang tương ứng
            card.style.cursor = "pointer";
            card.onclick = () => {
                if (courseCode === "toeic") {
                    window.location.href = "toeic_hub.html";
                } else if (courseCode === "ielts") {
                    window.location.href = "ielts_exams.html";
                } else if (courseCode === "cambridge") {
                    window.location.href = "cambridge_hub.html";
                } else {
                    alert("Giao diện khóa học đang được thiết kế!");
                }
            };
        }
    });

    // Xử lý nút "Tiếp tục ngay" (Hoạt động gần đây)
    const recentActivityCard = document.querySelector('.bg-primary-container');
    if (recentActivityCard) {
        const textEl = recentActivityCard.querySelector('p');
        if (textEl && textEl.textContent.toLowerCase().includes("ielts") && !allowedCodes.includes("ielts")) {
            // Đổi hoạt động gần đây sang TOEIC nếu IELTS bị khóa
            textEl.textContent = "TOEIC Listening: Part 1 Practice";
            const btn = recentActivityCard.querySelector('button');
            if (btn) {
                btn.onclick = () => window.location.href = "toeic_hub.html";
            }
        } else {
            const btn = recentActivityCard.querySelector('button');
            if (btn) {
                btn.onclick = () => {
                    const text = textEl.textContent.toLowerCase();
                    if (text.includes("ielts")) window.location.href = "student_dashboard.html";
                    else window.location.href = "toeic_hub.html";
                };
            }
        }
    }
}

// 3. Hiển thị điểm số học tập cá nhân lên lịch sử
async function loadStudentActivity() {
    // Trực quan hóa điểm số gần đây của học viên đăng nhập
    try {
        const scoreItems = document.querySelectorAll('main aside div.space-y-space-md');
        if (scoreItems.length === 0) return;

        // Lấy kết quả làm bài của học viên hiện tại
        const { data: results, error } = await supabase
            .from('exam_results')
            .select(`
                score,
                total_questions,
                taken_at,
                exams (
                    title
                )
            `)
            .eq('student_id', window.currentUser.id)
            .order('taken_at', { ascending: false })
            .limit(3);

        if (error) throw error;
        
        // Lấy thẻ div chứa danh sách điểm số (Grade History)
        const parentContainer = document.querySelector('main aside div:first-child');
        if (!parentContainer) return;

        const titleHeader = parentContainer.querySelector('h3');
        if (!titleHeader || !titleHeader.textContent.includes("Lịch sử điểm")) return;

        // Dọn dẹp các dòng tĩnh cũ
        const scoreListContainer = parentContainer.querySelector('.space-y-space-md') || parentContainer;
        scoreListContainer.innerHTML = "";

        if (!results || results.length === 0) {
            scoreListContainer.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Bạn chưa thực hiện bài thi online nào.</p>`;
            return;
        }

        results.forEach(res => {
            const item = document.createElement('div');
            item.className = "flex items-center gap-space-md p-space-sm border border-outline-variant rounded-lg bg-surface-bright";
            
            const accuracy = Math.round((res.score / res.total_questions) * 100);
            const dateStr = new Date(res.taken_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            const title = res.exams?.title || "Bài test online";

            item.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center font-bold text-xs text-primary shrink-0">${accuracy}%</div>
                <div class="flex-grow">
                    <p class="font-label-md text-xs font-bold text-primary truncate max-w-[150px]">${title}</p>
                    <p class="text-[10px] text-slate-400">Đúng ${res.score}/${res.total_questions} • Ngày ${dateStr}</p>
                </div>
            `;
            scoreListContainer.appendChild(item);
        });

    } catch (err) {
        console.error("Lỗi lấy hoạt động học tập:", err);
    }
}
