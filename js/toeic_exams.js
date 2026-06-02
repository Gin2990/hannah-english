/**
 * THƯ VIỆN ĐỀ THI TOEIC - DỰ ÁN HANNAH ENGLISH (SUPABASE DRIVEN)
 */

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof supabase !== 'undefined' && supabase) {
            initToeicExams();
        }
    }, 1000);
});

async function initToeicExams() {
    console.log("Khởi chạy Thư viện Đề thi TOEIC...");

    if (!window.currentUser) return;

    // 1. Kiểm tra xem học viên có quyền truy cập khóa TOEIC không
    const hasPermission = await checkToeicPermission(window.currentUser.id);
    if (!hasPermission) {
        alert("🔒 Bạn chưa được phân quyền truy cập khóa học TOEIC! Chuyển về Dashboard chính.");
        window.location.href = "student_dashboard.html";
        return;
    }

    // 2. Tải toàn bộ đề thi TOEIC từ Supabase
    await loadToeicExamsList();
}

// 1. Kiểm tra quyền truy cập TOEIC
async function checkToeicPermission(studentId) {
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
        
        return data.some(item => item.courses?.code === 'toeic');
    } catch (err) {
        console.error("Lỗi kiểm tra quyền TOEIC:", err);
        return false;
    }
}

// 2. Tải và hiển thị danh sách đề thi TOEIC online
async function loadToeicExamsList() {
    // Tìm container grid chứa các card đề thi
    // Trong file toeic_exams.html, có 1 thẻ main, bên dưới chứa bộ lọc và grid
    const mainGrid = document.querySelector('main .grid');
    if (!mainGrid) return;

    mainGrid.innerHTML = `
        <div class="col-span-full text-center py-20 text-slate-400 text-xs">
            <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            Đang tải danh sách đề thi TOEIC online...
        </div>
    `;

    try {
        // Lấy ID của khóa học TOEIC trước
        const { data: course, error: cError } = await supabase
            .from('courses')
            .select('id')
            .eq('code', 'toeic')
            .single();

        if (cError) throw cError;

        // Lấy toàn bộ đề thi thuộc về khóa TOEIC
        const { data: exams, error: eError } = await supabase
            .from('exams')
            .select('*')
            .eq('course_id', course.id)
            .order('created_at', { ascending: false });

        if (eError) throw eError;

        if (!exams || exams.length === 0) {
            mainGrid.innerHTML = `
                <div class="col-span-full text-center py-20 text-slate-400 text-sm">
                    <span class="material-symbols-outlined text-4xl block mb-2">sentiment_dissatisfied</span>
                    Hiện tại chưa có đề thi TOEIC nào được xuất bản.
                </div>
            `;
            return;
        }

        mainGrid.innerHTML = ""; // Xóa dữ liệu cũ

        exams.forEach((exam, index) => {
            const card = document.createElement('div');
            // Thiết kế bento: card đầu tiên to nổi bật (Featured), các card sau tiêu chuẩn
            const isFeatured = index === 0;
            
            if (isFeatured) {
                card.className = "md:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-xl flex flex-col justify-between hover:border-primary hover:shadow-md transition-all group relative overflow-hidden";
                card.innerHTML = `
                    <div class="relative z-10 space-y-4">
                        <span class="bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Đề thi mới nhất</span>
                        <h3 class="font-headline-lg text-primary group-hover:text-primary-container transition-colors">${exam.title}</h3>
                        <p class="text-on-surface-variant text-sm max-w-xl">Trải nghiệm kỳ thi TOEIC đầy đủ gồm các câu hỏi đọc hiểu và ngữ pháp chuẩn ETS. Đề thi có đếm ngược thời gian làm bài thực tế.</p>
                        <div class="flex gap-space-lg text-xs font-semibold text-slate-500 pt-2">
                            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">timer</span> ${exam.duration} phút</span>
                            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">quiz</span> ${exam.question_count} câu hỏi</span>
                        </div>
                    </div>
                    <div class="pt-6 relative z-10">
                        <button onclick="startExam('${exam.id}')" class="px-6 py-3 bg-primary hover:bg-primary-container text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all shadow-md flex items-center gap-1">
                            <span>Bắt đầu thi ngay</span>
                            <span class="material-symbols-outlined text-sm">play_arrow</span>
                        </button>
                    </div>
                    <div class="absolute right-[-30px] bottom-[-30px] opacity-[0.03] select-none pointer-events-none group-hover:scale-105 transition-transform duration-500">
                        <span class="material-symbols-outlined text-[200px]">timer</span>
                    </div>
                `;
            } else {
                card.className = "md:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-lg flex flex-col justify-between hover:border-primary hover:shadow-md transition-all group relative";
                card.innerHTML = `
                    <div class="space-y-3">
                        <h4 class="font-headline-lg text-primary text-lg group-hover:text-primary-container transition-colors line-clamp-2">${exam.title}</h4>
                        <div class="flex gap-4 text-xs font-semibold text-slate-400 pt-2">
                            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">timer</span> ${exam.duration} phút</span>
                            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">quiz</span> ${exam.question_count} câu</span>
                        </div>
                    </div>
                    <div class="pt-6">
                        <button onclick="startExam('${exam.id}')" class="w-full py-2.5 bg-slate-100 hover:bg-primary hover:text-white text-primary font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1">
                            <span>Vào thi thử</span>
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

// Chuyển tới phòng thi
function startExam(examId) {
    if (confirm("🔔 Bạn đã sẵn sàng làm bài thi này chưa?\nĐồng hồ đếm ngược sẽ bắt đầu chạy ngay khi bạn vào phòng thi.")) {
        window.location.href = `exam_taker.html?id=${examId}`;
    }
}
