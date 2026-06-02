/**
 * PHÂN HỆ HỒ SƠ CÁ NHÂN HỌC VIÊN - DỰ ÁN HANNAH ENGLISH (SUPABASE DRIVEN)
 */

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof supabase !== 'undefined' && supabase) {
            initUserProfile();
        }
    }, 1000);
});

async function initUserProfile() {
    console.log("Khởi chạy Trang Hồ sơ Học viên...");

    if (!window.currentUser) return;

    // 1. Tải kết quả thi lịch sử của học viên và vẽ lại bảng
    await loadExamHistoryTable();
}

// 1. Tải và tính toán dữ liệu lịch sử thi
async function loadExamHistoryTable() {
    const tableBody = document.querySelector('table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center py-6 text-slate-400 text-xs">
                <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Đang lấy lịch sử bài làm từ server...
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
                exams (
                    title,
                    courses (
                        title
                    )
                )
            `)
            .eq('student_id', window.currentUser.id)
            .order('taken_at', { ascending: false });

        if (error) throw error;

        // Cập nhật thống kê tổng quát trên Dashboard Hồ sơ
        updateProfileStats(results || []);

        if (!results || results.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-400 text-xs">Bạn chưa có lịch sử làm bài thi online.</td></tr>`;
            return;
        }

        tableBody.innerHTML = ""; // Xóa dữ liệu mẫu

        results.forEach(res => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-outline-variant hover:bg-slate-50 transition-colors";

            const examTitle = res.exams?.title || "Bài test online";
            const courseTitle = res.exams?.courses?.title || "Khóa học chung";
            const dateStr = new Date(res.taken_at).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            const accuracy = Math.round((res.score / res.total_questions) * 100);
            
            // Badge trạng thái dựa trên kết quả
            let badgeClass = "bg-green-50 text-green-700 border-green-200";
            let badgeText = "Đạt yêu cầu";
            if (accuracy < 50) {
                badgeClass = "bg-red-50 text-red-700 border-red-200";
                badgeText = "Chưa Đạt";
            } else if (accuracy < 80) {
                badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                badgeText = "Khá";
            }

            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-slate-800 text-xs">${examTitle}</td>
                <td class="px-6 py-4 text-slate-500 text-xs">${courseTitle}</td>
                <td class="px-6 py-4 text-slate-500 text-xs">${dateStr}</td>
                <td class="px-6 py-4 text-right">
                    <span class="px-2 py-0.5 border rounded text-[10px] font-bold ${badgeClass}">
                        Đúng ${res.score}/${res.total_questions} (${accuracy}%) - ${badgeText}
                    </span>
                </td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (err) {
        console.error("Lỗi lấy lịch sử thi hồ sơ:", err);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-red-500 text-xs">Lỗi lấy lịch sử từ server.</td></tr>`;
    }
}

// 2. Cập nhật các khối thông số & thành tựu (Badges)
function updateProfileStats(results) {
    const totalExams = results.length;
    
    // Tính điểm trung bình
    let avgAccuracy = 0;
    let totalSeconds = 0;
    
    if (totalExams > 0) {
        const sumAccuracy = results.reduce((acc, curr) => acc + (curr.score / curr.total_questions), 0);
        avgAccuracy = Math.round((sumAccuracy / totalExams) * 100);
        totalSeconds = results.reduce((acc, curr) => acc + curr.duration_seconds, 0);
    }

    const totalMinutes = Math.ceil(totalSeconds / 60);

    // Cập nhật các khối UI (Tổng số bài, Độ chính xác, Thời gian học)
    // Dựa trên cấu trúc grid stats trong profile.html:
    // Cột 1: Thẻ General Stats Grid
    const statCards = document.querySelectorAll('main section div.grid > div');
    
    if (statCards.length >= 3) {
        // Thẻ 1: Tổng số bài thi đã làm
        const totalExamsTitle = statCards[0].querySelector('div.text-headline-xl') || statCards[0].querySelector('div:first-child');
        if (totalExamsTitle) totalExamsTitle.innerHTML = `${totalExams} <span class="text-xs text-slate-400 font-semibold block">Đã hoàn thành</span>`;

        // Thẻ 2: Điểm trung bình / Độ chính xác
        const avgScoreTitle = statCards[1].querySelector('div.text-headline-xl') || statCards[1].querySelector('div:first-child');
        if (avgScoreTitle) avgScoreTitle.innerHTML = `${avgAccuracy}% <span class="text-xs text-slate-400 font-semibold block">Độ chính xác trung bình</span>`;

        // Thẻ 3: Thời gian làm bài thi
        const timeTitle = statCards[2].querySelector('div.text-headline-xl') || statCards[2].querySelector('div:first-child');
        if (timeTitle) timeTitle.innerHTML = `${totalMinutes} <span class="text-xs text-slate-400 font-semibold text-xs block">Phút ôn luyện online</span>`;
    }

    // 3. Cập nhật trạng thái Huy hiệu Thành tựu (Badges/Achievements)
    updateAchievementsBadges(results, totalMinutes);
}

// 4. Mở khóa Huy hiệu dynamically
function updateAchievementsBadges(results, totalMinutes) {
    // Có 3 huy hiệu được gán dựa trên kết quả thực tế
    const hasExams = results.length > 0;
    const hasToeicPro = results.some(res => {
        const isToeic = res.exams?.title?.toLowerCase().includes("toeic") || res.exams?.courses?.title?.toLowerCase().includes("toeic");
        const accuracy = (res.score / res.total_questions) * 100;
        return isToeic && accuracy >= 80;
    });
    const isDeepLearner = totalMinutes >= 15;

    // Tìm grid badges trong profile.html
    const badgesGrid = document.querySelector('main section div.grid-cols-2.md\\:grid-cols-4') || document.querySelector('main section .grid');
    if (!badgesGrid) return;

    // Lấy tất cả card badges (các thẻ con trực tiếp)
    const badgeCards = badgesGrid.children;
    
    // Thẻ 1: Huy hiệu Nhập môn (First Blood)
    if (badgeCards.length >= 1) {
        toggleBadgeState(badgeCards[0], hasExams, "Tân Binh Luyện Đề", "Hoàn thành bài thi online đầu tiên.", "military_tech", "emerald");
    }
    // Thẻ 2: Huy hiệu Master (TOEIC Champion)
    if (badgeCards.length >= 2) {
        toggleBadgeState(badgeCards[1], hasToeicPro, "Cao Thủ TOEIC", "Đạt điểm chính xác >= 80% một bài TOEIC.", "workspace_premium", "indigo");
    }
    // Thẻ 3: Huy hiệu Chăm chỉ (Deep Learner)
    if (badgeCards.length >= 3) {
        toggleBadgeState(badgeCards[2], isDeepLearner, "Chiến Binh Bền Bỉ", "Dành hơn 15 phút ôn luyện trong phòng thi.", "hourglass_empty", "purple");
    }
}

// Helper thay đổi class hiển thị badge Sáng / Tối
function toggleBadgeState(card, isUnlocked, title, desc, iconName, colorName) {
    if (isUnlocked) {
        card.className = "p-4 bg-white border border-slate-200 rounded-xl text-center shadow-sm flex flex-col items-center justify-center transition-all hover:scale-103 hover:shadow-md";
        card.innerHTML = `
            <div class="w-12 h-12 rounded-full bg-${colorName}-50 border border-${colorName}-200 text-${colorName}-600 flex items-center justify-center mb-3">
                <span class="material-symbols-outlined text-2xl font-bold">${iconName}</span>
            </div>
            <h5 class="font-bold text-xs text-slate-800 mb-1">${title}</h5>
            <p class="text-[10px] text-slate-400 leading-normal max-w-[120px] mx-auto">${desc}</p>
            <span class="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-2.5">ĐÃ ĐẠT</span>
        `;
    } else {
        card.className = "p-4 bg-slate-50 border border-slate-200/50 rounded-xl text-center flex flex-col items-center justify-center opacity-60 select-none grayscale";
        card.innerHTML = `
            <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-3">
                <span class="material-symbols-outlined text-2xl">lock</span>
            </div>
            <h5 class="font-bold text-xs text-slate-500 mb-1">${title}</h5>
            <p class="text-[10px] text-slate-450 leading-normal max-w-[120px] mx-auto">${desc}</p>
            <span class="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded mt-2.5">BỊ KHÓA</span>
        `;
    }
}
