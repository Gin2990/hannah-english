/**
 * HỆ THỐNG QUẢN TRỊ ADMIN - DỰ ÁN HANNAH ENGLISH (SUPABASE DRIVEN)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Chờ 1.5s để Session của auth_check.js ổn định rồi tải dữ liệu
    setTimeout(() => {
        if (typeof supabase !== 'undefined' && supabase) {
            initAdminDashboard();
        }
    }, 1000);
});

async function initAdminDashboard() {
    console.log("Khởi chạy Bảng điều khiển Admin...");
    
    // 1. Tải danh sách khóa học hệ thống
    const courses = await fetchSystemCourses();
    
    // 2. Tải danh sách người dùng và phân quyền tương ứng
    await loadUsersList(courses);
    
    // 3. Tải danh sách khóa học lên bảng Quản lý khóa học
    await loadCoursesTable(courses);
    
    // 4. Cấu hình chuyển đổi tab menu (SPA Navigation)
    setupTabNavigation();
    
    // 5. Cấu hình sự kiện cho nút "Thêm mới" người dùng
    setupAddUserEvent();
}

// =========================================================================
// PHẦN A: ĐIỀU HƯỚNG TAB ĐỘNG (SPA NAVIGATION)
// =========================================================================
function setupTabNavigation() {
    const tabBtns = {
        overview: document.getElementById('tab-btn-overview'),
        users: document.getElementById('tab-btn-users'),
        courses: document.getElementById('tab-btn-courses')
    };

    const views = {
        overview: document.getElementById('view-overview'),
        users: document.getElementById('view-users'),
        courses: document.getElementById('view-courses')
    };

    // Hàm chuyển đổi hiển thị view
    function switchView(activeTab) {
        // Cập nhật trạng thái class của các nút menu
        Object.keys(tabBtns).forEach(key => {
            const btn = tabBtns[key];
            if (!btn) return;
            if (key === activeTab) {
                btn.className = "flex items-center gap-space-md px-space-md py-space-sm rounded sidebar-item-active cursor-pointer";
            } else {
                btn.className = "flex items-center gap-space-md px-space-md py-space-sm rounded text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer";
            }
        });

        // Ẩn/Hiện các view tương ứng
        Object.keys(views).forEach(key => {
            const view = views[key];
            if (!view) return;
            if (key === activeTab) {
                view.classList.remove('hidden');
            } else {
                view.classList.add('hidden');
            }
        });
    }

    // Gắn sự kiện click
    Object.keys(tabBtns).forEach(key => {
        const btn = tabBtns[key];
        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                switchView(key);
            };
        }
    });
}

// =========================================================================
// PHẦN B: QUẢN LÝ KHÓA HỌC (COURSES MANAGEMENT)
// =========================================================================

// 1. Tải danh sách khóa học từ Supabase
async function fetchSystemCourses() {
    try {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .order('title', { ascending: true });
            
        if (error) throw error;
        
        // Đồng bộ số lượng khóa học lên Stat Card "Khóa học hiện có"
        const statCardCount = document.querySelector('section div:nth-child(3) h2');
        if (statCardCount) {
            statCardCount.textContent = data ? data.length : 0;
        }
        
        return data || [];
    } catch (err) {
        console.error("Lỗi lấy danh sách khóa học:", err);
        return [];
    }
}

// 2. Hiển thị danh sách khóa học lên bảng quản trị
async function loadCoursesTable(courses) {
    const tbody = document.getElementById('courses-table-body');
    if (!tbody) return;

    if (courses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-400 text-xs">Hiện tại hệ thống chưa khởi tạo khóa học nào.</td></tr>`;
        return;
    }

    tbody.innerHTML = ""; // Xóa dữ liệu cũ

    courses.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-surface-container-low transition-colors";
        tr.innerHTML = `
            <td class="px-gutter py-4 font-bold text-primary text-xs">${c.title}</td>
            <td class="px-gutter py-4"><span class="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-700 font-bold">${c.code}</span></td>
            <td class="px-gutter py-4 text-xs text-slate-650 truncate max-w-sm" title="${c.description || ''}">${c.description || 'Chưa cập nhật mô tả'}</td>
            <td class="px-gutter py-4 text-right">
                <div class="flex justify-end gap-2">
                    <button onclick="editCoursePrompt('${c.id}', '${c.title}', '${c.description || ''}')" class="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-all" title="Sửa khóa học">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onclick="deleteCourse('${c.id}', '${c.title}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Xóa khóa học">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Thêm mới khóa học
async function createNewCoursePrompt() {
    const title = prompt("Nhập tên khóa học mới (Ví dụ: IELTS Advanced 7.5+):");
    if (!title) return;

    const code = prompt("Nhập mã code độc nhất (viết liền, ví dụ: ielts_adv, toeic_750):");
    if (!code) return;

    const desc = prompt("Nhập mô tả tóm tắt cho khóa học:");
    
    try {
        const { error } = await supabase
            .from('courses')
            .insert({
                title: title,
                code: code.trim().toLowerCase(),
                description: desc
            });

        if (error) throw error;

        showToast("Đã thêm khóa học mới thành công!");
        
        // Tải lại dữ liệu & cập nhật bảng
        const updatedCourses = await fetchSystemCourses();
        loadCoursesTable(updatedCourses);
    } catch (err) {
        console.error("Lỗi thêm khóa học:", err);
        alert("Không thể thêm khóa học: " + err.message);
    }
}

// 4. Chỉnh sửa khóa học
async function editCoursePrompt(courseId, currentTitle, currentDesc) {
    const title = prompt("Nhập tên khóa học mới:", currentTitle);
    if (!title) return;

    const desc = prompt("Nhập mô tả khóa học mới:", currentDesc);

    try {
        const { error } = await supabase
            .from('courses')
            .update({
                title: title,
                description: desc
            })
            .eq('id', courseId);

        if (error) throw error;

        showToast("Đã cập nhật thông tin khóa học!");
        
        const updatedCourses = await fetchSystemCourses();
        loadCoursesTable(updatedCourses);
    } catch (err) {
        console.error("Lỗi cập nhật khóa học:", err);
        alert("Lỗi cập nhật khóa học: " + err.message);
    }
}

// 5. Xóa khóa học
async function deleteCourse(courseId, courseTitle) {
    if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc muốn xóa vĩnh viễn khóa học "${courseTitle}"?\nTất cả đề thi và phân quyền học viên liên quan cũng sẽ bị xóa bỏ.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', courseId);

        if (error) throw error;

        showToast("Đã xóa khóa học khỏi hệ thống!");
        
        const updatedCourses = await fetchSystemCourses();
        loadCoursesTable(updatedCourses);
    } catch (err) {
        console.error("Lỗi xóa khóa học:", err);
        alert("Không thể xóa khóa học: " + err.message);
    }
}

// =========================================================================
// PHẦN C: QUẢN LÝ HỘI VIÊN (USER MANAGER)
// =========================================================================

// Tải toàn bộ người dùng online và hiển thị
async function loadUsersList(courses) {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-8 text-slate-400 text-xs">
                <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Đang tải danh sách thành viên trực tuyến...
            </td>
        </tr>
    `;

    try {
        // Lấy tất cả user profiles
        const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (usersError) throw usersError;

        if (!users || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 text-xs">Chưa có người dùng nào đăng ký online.</td></tr>`;
            return;
        }

        // Đồng bộ số lượng tài khoản lên Stat Card
        const statCardUsersCount = document.querySelector('section div:first-child h2');
        if (statCardUsersCount) {
            statCardUsersCount.textContent = users.length;
        }

        // Lấy toàn bộ phân quyền khóa học để ánh xạ
        const { data: studentCourses, error: scError } = await supabase
            .from('student_courses')
            .select('*');
            
        if (scError) throw scError;

        tbody.innerHTML = ""; // Xóa dữ liệu cũ

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-surface-container-low transition-colors";
            
            // Viết tắt avatar
            const initials = user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
            
            // Lấy danh sách ID khóa học đã được gán cho học viên này
            const assignedCourseIds = studentCourses
                .filter(sc => sc.student_id === user.id)
                .map(sc => sc.course_id);

            // Tạo các checkbox phân quyền khóa học
            let courseCheckboxesHtml = "";
            if (user.role === 'student') {
                courses.forEach(c => {
                    const isChecked = assignedCourseIds.includes(c.id) ? 'checked' : '';
                    courseCheckboxesHtml += `
                        <label class="inline-flex items-center gap-1.5 mr-3 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded text-xs select-none cursor-pointer hover:bg-slate-100 transition-all">
                            <input type="checkbox" 
                                   class="rounded border-slate-350 text-primary focus:ring-primary w-3 h-3" 
                                   ${isChecked} 
                                   onchange="toggleCoursePermission('${user.id}', '${c.id}', this)"/>
                            <span class="font-medium text-slate-700">${c.title.split(' ')[0]}</span>
                        </label>
                    `;
                });
            } else {
                courseCheckboxesHtml = `<span class="text-slate-400 italic text-xs">Quyền quản trị toàn hệ thống</span>`;
            }

            // Options chọn vai trò (Role Dropdown)
            const roles = [
                { value: 'student', label: 'Học viên' },
                { value: 'teacher', label: 'Giảng viên' },
                { value: 'admin', label: 'Admin' }
            ];
            
            let roleOptionsHtml = "";
            roles.forEach(r => {
                const isSelected = user.role === r.value ? 'selected' : '';
                roleOptionsHtml += `<option value="${r.value}" ${isSelected}>${r.label}</option>`;
            });

            tr.innerHTML = `
                <td class="px-gutter py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                            ${initials}
                        </div>
                        <div>
                            <p class="font-label-md text-label-md text-primary font-bold">${user.full_name || 'Thành viên mới'}</p>
                            <p class="text-[11px] text-secondary">${user.email}</p>
                        </div>
                    </div>
                </td>
                <td class="px-gutter py-4">
                    <select onchange="updateUserRole('${user.id}', this.value)" class="text-xs font-bold rounded-lg border-slate-250 py-1.5 focus:ring-primary focus:border-primary text-slate-700 bg-slate-50">
                        ${roleOptionsHtml}
                    </select>
                </td>
                <td class="px-gutter py-4">
                    <div class="flex flex-wrap gap-1">
                        ${courseCheckboxesHtml}
                    </div>
                </td>
                <td class="px-gutter py-4">
                    <span class="flex items-center gap-1.5 text-label-sm text-green-600">
                        <span class="w-2 h-2 rounded-full bg-green-500"></span> Hoạt động
                    </span>
                </td>
                <td class="px-gutter py-4 text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="editUserFullName('${user.id}', '${user.full_name}')" class="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-all" title="Chỉnh sửa họ tên">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onclick="deleteUserAccount('${user.id}', '${user.full_name}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Xóa tài khoản">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Cập nhật số lượng hiển thị dưới bảng người dùng
        const countText = document.querySelector('section p.text-label-sm');
        if (countText) {
            countText.textContent = `Hiển thị 1-${users.length} trong số ${users.length} thành viên trực tuyến`;
        }

    } catch (err) {
        console.error("Lỗi hiển thị danh sách admin:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500 text-xs">Lỗi đồng bộ dữ liệu người dùng với Supabase.</td></tr>`;
    }
}

// 3. Sửa họ tên người dùng
async function editUserFullName(userId, currentName) {
    const newName = prompt("Nhập họ và tên mới cho thành viên:", currentName);
    if (!newName || newName.trim() === currentName) return;

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ full_name: newName.trim() })
            .eq('id', userId);

        if (error) throw error;

        showToast("Đã sửa họ tên người dùng thành công!");
        
        // Tải lại bảng người dùng
        const courses = await fetchSystemCourses();
        loadUsersList(courses);
    } catch (err) {
        console.error("Lỗi sửa tên thành viên:", err);
        alert("Lỗi khi sửa họ tên: " + err.message);
    }
}

// 4. Cập nhật Vai trò người dùng online
async function updateUserRole(userId, newRole) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) throw error;
        
        showToast("Đã cập nhật vai trò người dùng thành công!");
        
        // Tải lại bảng để cập nhật giao diện phân quyền
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
        console.error("Lỗi cập nhật vai trò:", err);
        alert("Lỗi khi cập nhật vai trò: " + err.message);
    }
}

// 5. Bật/Tắt phân quyền khóa học cho học viên
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
            showToast("Đã cấp quyền truy cập khóa học!");
        } else {
            // Hủy phân quyền
            const { error } = await supabase
                .from('student_courses')
                .delete()
                .eq('student_id', studentId)
                .eq('course_id', courseId);
            if (error) throw error;
            showToast("Đã gỡ quyền truy cập khóa học!");
        }
    } catch (err) {
        console.error("Lỗi cập nhật quyền khóa học:", err);
        alert("Không thể cập nhật quyền khóa học: " + err.message);
        checkbox.checked = !isChecked; // Trả lại trạng thái cũ
    }
}

// 6. Thêm mới tài khoản (Tạo User)
function setupAddUserEvent() {
    const addBtn = document.querySelector('button[class*="person_add"]') || document.querySelector('button[onclick*="person_add"]');
    if (!addBtn) return;

    addBtn.onclick = async () => {
        const fullName = prompt("Nhập họ và tên học viên mới:");
        if (!fullName) return;

        const email = prompt("Nhập địa chỉ Email:");
        if (!email) return;

        const password = prompt("Nhập mật khẩu (tối thiểu 6 ký tự):");
        if (!password || password.length < 6) {
            alert("Mật khẩu không hợp lệ hoặc quá ngắn!");
            return;
        }

        try {
            // Đăng ký tài khoản online qua API của Supabase
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            alert(`🎉 Tạo tài khoản thành công cho ${fullName}!\nThông tin tài khoản đã được đồng bộ online.`);
            window.location.reload();

        } catch (err) {
            console.error("Lỗi tạo tài khoản:", err);
            alert("Lỗi tạo tài khoản: " + err.message);
        }
    };
}

// 7. Xóa tài khoản
async function deleteUserAccount(userId, fullName) {
    if (userId === window.currentUser.id) {
        alert("Bạn không thể tự xóa tài khoản của chính mình!");
        return;
    }

    if (!confirm(`⚠️ Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của ${fullName}?\nTất cả kết quả thi và phân quyền liên quan cũng sẽ bị xóa.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) throw error;
        
        showToast("Đã xóa tài khoản thành công!");
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
        console.error("Lỗi xóa tài khoản:", err);
        alert("Không thể xóa tài khoản: " + err.message);
    }
}

// Hàm hiển thị Toast thông báo nhanh góc màn hình
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
