/**
 * THƯ VIỆN ĐỀ THI IELTS - DỰ ÁN HANNAH ENGLISH (SUPABASE DRIVEN)
 */

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof supabase !== 'undefined' && supabase) {
            initIeltsExams();
        }
    }, 1000);
});

async function initIeltsExams() {
    console.log("Khởi chạy Thư viện Đề thi IELTS...");

    if (!window.currentUser) return;

    // 1. Kiểm tra xem học viên có quyền truy cập khóa IELTS không
    const hasPermission = await checkIeltsPermission(window.currentUser.id);
    if (!hasPermission) {
        alert("🔒 Bạn chưa được phân quyền truy cập khóa học IELTS! Vui lòng liên hệ Admin để đăng ký khóa học.");
        window.location.href = "student_dashboard.html";
        return;
    }

    // 2. Tải toàn bộ đề thi IELTS từ Supabase
    await loadIeltsExamsList();
}

// 1. Kiểm tra quyền truy cập IELTS từ student_courses
async function checkIeltsPermission(studentId) {
    try {
        const { data, error } = await supabase
            .from('student_courses')
            .select(`
                courses (
                    code
                )
            `)
            .eq('student_id', studentId);

        if (error) throw error;
        
        return data.some(item => item.courses?.code === 'ielts');
    } catch (err) {
        console.error("Lỗi kiểm tra quyền IELTS:", err);
        return false;
    }
}

// 2. Tải và hiển thị đề thi IELTS từ Supabase
async function loadIeltsExamsList() {
    const mainGrid = document.getElementById('ielts-exams-grid');
    const countLabel = document.getElementById('exams-count-label');
    if (!mainGrid) return;

    try {
        // Lấy ID của khóa học IELTS
        const { data: course, error: cError } = await supabase
            .from('courses')
            .select('id')
            .eq('code', 'ielts')
            .single();

        if (cError) throw cError;

        // Lấy danh sách đề thi IELTS
        const { data: exams, error: eError } = await supabase
            .from('exams')
            .select('*')
            .eq('course_id', course.id)
            .order('created_at', { ascending: false });

        if (eError) throw eError;

        if (countLabel) {
            countLabel.innerHTML = `Hiển thị <span class="font-bold text-primary">${exams ? exams.length : 0}</span> đề thi online`;
        }

        if (!exams || exams.length === 0) {
            mainGrid.innerHTML = `
                <div class="col-span-full text-center py-20 text-slate-400 text-sm">
                    <span class="material-symbols-outlined text-4xl block mb-2">sentiment_dissatisfied</span>
                    Hiện tại giảng viên chưa xuất bản đề thi thử IELTS nào.
                </div>
            `;
            return;
        }

        mainGrid.innerHTML = ""; // Xóa màn hình tải cũ

        exams.forEach((exam, index) => {
            const card = document.createElement('div');
            // Thẻ đầu tiên nổi bật (Featured), còn lại tiêu chuẩn
            const isFeatured = index === 0;
            
            if (isFeatured) {
                card.className = "md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-primary hover:shadow-md transition-all group relative overflow-hidden";
                card.innerHTML = `
                    <div class="relative z-10 space-y-3">
                        <span class="bg-primary text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Đề thi IELTS mới nhất</span>
                        <h3 class="font-bold text-primary text-lg group-hover:text-primary-container transition-colors pt-1">${exam.title}</h3>
                        <p class="text-slate-500 text-xs leading-relaxed max-w-lg">Làm bài luyện tập thi thử kỹ năng IELTS chuyên sâu, chấm điểm tự động tích hợp, đo lường thời gian làm bài chính xác từng giây.</p>
                        <div class="flex gap-4 text-xs font-semibold text-slate-400 pt-2">
                            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">timer</span> ${exam.duration} phút</span>
                            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">quiz</span> ${exam.question_count} câu hỏi</span>
                        </div>
                    </div>
                    <div class="pt-6 relative z-10">
                        <button onclick="startExam('${exam.id}')" class="px-5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-lg text-xs uppercase tracking-wide transition-all shadow-md flex items-center gap-1">
                            <span>Bắt đầu thi thử</span>
                            <span class="material-symbols-outlined text-sm">play_arrow</span>
                        </button>
                    </div>
                    <div class="absolute right-[-20px] bottom-[-20px] opacity-[0.03] select-none pointer-events-none group-hover:scale-105 transition-transform duration-500">
                        <span class="material-symbols-outlined text-[150px]">workspace_premium</span>
                    </div>
                `;
            } else {
                card.className = "bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-primary hover:shadow-md transition-all group relative";
                card.innerHTML = `
                    <div class="space-y-3">
                        <h4 class="font-bold text-primary text-sm group-hover:text-primary-container transition-colors line-clamp-2">${exam.title}</h4>
                        <div class="flex gap-4 text-xs font-semibold text-slate-400 pt-2">
                            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">timer</span> ${exam.duration} phút</span>
                            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">quiz</span> ${exam.question_count} câu</span>
                        </div>
                    </div>
                    <div class="pt-6">
                        <button onclick="startExam('${exam.id}')" class="w-full py-2 bg-slate-50 hover:bg-primary hover:text-white text-primary font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-slate-200">
                            <span>Bắt đầu thi</span>
                            <span class="material-symbols-outlined text-xs">play_arrow</span>
                        </button>
                    </div>
                `;
            }
            
            mainGrid.appendChild(card);
        });

    } catch (err) {
        console.error("Lỗi tải đề thi online:", err);
        mainGrid.innerHTML = `<div class="col-span-full text-center py-20 text-red-500 text-xs">Lỗi lấy dữ liệu đề thi online từ Supabase.</div>`;
    }
}

// Bắt đầu làm bài thi
function startExam(examId) {
    if (confirm("🔔 Bạn đã sẵn sàng bắt đầu bài thi thử IELTS này chưa?\nThời gian đếm ngược sẽ chạy ngay lập tức khi vào phòng thi.")) {
        window.location.href = `exam_taker.html?id=${examId}`;
    }
}
