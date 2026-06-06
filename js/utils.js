/**
 * CÁC HÀM TIỆN ÍCH DÙNG CHUNG - HANNAH ENGLISH
 */

// Định dạng ngày tháng sang dd/mm/yyyy hh:mm hoặc dd/mm/yyyy
function formatDate(dateString, includeTime = false) {
    if (!dateString) return 'Chưa cập nhật';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    if (includeTime) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
    return `${day}/${month}/${year}`;
}

// Định dạng điểm số và tỉ lệ phần trăm
function formatScore(score, total) {
    if (total <= 0) return '0/0 (0%)';
    const accuracy = Math.round((score / total) * 100);
    return `${score}/${total} (${accuracy}%)`;
}

// Chuyển hướng người dùng dựa theo vai trò (Role-based redirection)
function redirectByRole(role) {
    if (role === 'admin') {
        window.location.href = "admin_dashboard.html";
    } else if (role === 'teacher') {
        window.location.href = "teacher_dashboard.html";
    } else {
        window.location.href = "student_dashboard.html";
    }
}

// Hiển thị thông báo Toast nhanh góc màn hình
function showToast(message, type = 'success') {
    const existing = document.getElementById('global-toast-msg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = "global-toast-msg";
    
    // Thiết lập màu sắc theo loại
    let icon = 'check_circle';
    let iconColor = 'text-emerald-400';
    if (type === 'error') {
        icon = 'error';
        iconColor = 'text-red-500';
    } else if (type === 'warning') {
        icon = 'warning';
        iconColor = 'text-amber-500';
    }

    toast.className = "fixed top-4 right-4 z-[99999] bg-[#001e40] text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-2 transition-all duration-300";
    toast.innerHTML = `
        <span class="material-symbols-outlined text-sm ${iconColor}">${icon}</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
