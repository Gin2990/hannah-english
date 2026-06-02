/**
 * CHƯƠNG TRÌNH KIỂM TRA PHÂN QUYỀN VÀ KHỞI TẠO SESSI0N (ONLINE AUTH)
 * 
 * Script này được nhúng trên tất cả các trang giao diện mẫu để tự động:
 * 1. Kiểm tra trạng thái đăng nhập online qua Supabase.
 * 2. Bảo vệ các trang Dashboard (Admin, Teacher, Student) khỏi truy cập trái phép.
 * 3. Thay đổi thông tin hiển thị (tên, email, ảnh đại diện) động theo phiên đăng nhập thực tế.
 * 4. Nhúng widget "Đăng xuất" và thông tin vai trò ở góc màn hình.
 */

(async function () {
    // Chờ tài nguyên tải xong
    window.addEventListener('load', async () => {
        // 1. Kiểm tra xem có cấu hình Supabase chưa
        if (typeof supabase === 'undefined' || !supabase) {
            console.warn("Supabase client chưa được khởi tạo. Bỏ qua kiểm tra phân quyền!");
            injectWarningBanner("Chưa cấu hình Supabase! Vui lòng mở file js/config.js và nhập API Key để trang web hoạt động online.");
            return;
        }

        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        
        // Bỏ qua trang đăng nhập và trang chủ Hannah English (không bắt buộc đăng nhập)
        if (currentPath === 'auth.html' || currentPath === 'home.html') {
            return;
        }

        try {
            // 2. Lấy session hiện tại từ Supabase
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) throw sessionError;

            // Nếu chưa đăng nhập -> chuyển hướng về trang auth.html
            if (!session) {
                window.location.href = "auth.html";
                return;
            }

            // 3. Tải thông tin vai trò (role) từ public.profiles
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profileError) {
                console.error("Lỗi lấy thông tin vai trò:", profileError);
                // Nếu profile chưa tồn tại (ví dụ do lỗi trigger), ta cố gắng tự tạo tạm thời
                const fallbackProfile = {
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || "Thành viên mới",
                    role: "student"
                };
                window.currentUser = fallbackProfile;
            } else {
                window.currentUser = profile;
            }

            console.log("Đã xác thực người dùng online:", window.currentUser);

            // 4. Kiểm tra phân quyền truy cập trang (Authorization)
            enforceAuthorization(currentPath, window.currentUser.role);

            // 5. Thay đổi giao diện động (Cập nhật tên người dùng Minh -> Tên thật)
            updatePageDynamicContent(window.currentUser);

            // 6. Nhúng widget hiển thị tài khoản & đăng xuất ở góc dưới bên trái
            injectUserWidget(window.currentUser);

        } catch (err) {
            console.error("Lỗi kiểm tra phiên đăng nhập:", err);
            // Nếu có lỗi nghiêm trọng, chuyển hướng về auth
            window.location.href = "auth.html";
        }
    });

    // Hàm thực thi kiểm tra bảo mật trang
    function enforceAuthorization(page, role) {
        if (page === 'admin_dashboard.html' && role !== 'admin') {
            alert("⚠️ Bạn không có quyền truy cập trang quản trị! Chuyển về trang học viên.");
            window.location.href = "student_dashboard.html";
        }
        else if (page === 'teacher_dashboard.html' && role !== 'teacher' && role !== 'admin') {
            alert("⚠️ Bạn không có quyền truy cập trang giảng viên! Chuyển về trang học viên.");
            window.location.href = "student_dashboard.html";
        }
    }

    // Hàm cập nhật tên hiển thị của người dùng trên toàn bộ giao diện
    function updatePageDynamicContent(user) {
        const nameText = user.full_name || "Học viên";
        
        // Duyệt toàn bộ body để tìm và thay thế tên "Minh" mặc định bằng tên người dùng thực tế
        document.body.innerHTML = document.body.innerHTML
            .replace(/Chào buổi sáng, Minh!/g, `Chào buổi sáng, ${nameText}!`)
            .replace(/Chào buổi sáng, Minh/g, `Chào buổi sáng, ${nameText}`)
            .replace(/Minh!/g, `${nameText}!`)
            .replace(/đại diện người dùng/g, `${nameText}`);

        // Thay ảnh avatar mặc định bằng chữ cái đầu nếu ảnh rỗng (tăng tính cá nhân hóa)
        const avatars = document.querySelectorAll('img[alt*="đại diện"], img[alt*="avatar"], img[alt*="Ảnh đại diện"]');
        avatars.forEach(img => {
            const letterAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameText)}&background=001e40&color=fff&bold=true&size=128`;
            img.src = letterAvatar;
        });
    }

    // Hàm nhúng Banner cảnh báo chưa cấu hình API Key
    function injectWarningBanner(msg) {
        const banner = document.createElement('div');
        banner.className = "fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 px-4 z-[9999] font-semibold text-xs flex justify-center items-center gap-2 shadow-md";
        banner.innerHTML = `
            <span class="material-symbols-outlined text-sm">warning</span>
            <span>${msg}</span>
        `;
        document.body.appendChild(banner);
        document.body.style.paddingTop = "36px";
    }

    // Hàm nhúng Widget Tài khoản / Đăng xuất ở góc dưới bên trái màn hình
    function injectUserWidget(user) {
        // Tránh tạo widget trên trang auth
        if (document.getElementById('supabase-user-widget')) return;

        const widget = document.createElement('div');
        widget.id = "supabase-user-widget";
        widget.className = "fixed bottom-4 left-4 z-[9999] bg-white text-slate-800 border border-slate-200/80 p-3 rounded-xl shadow-lg flex items-center gap-3 transition-all hover:shadow-xl";
        
        const roleNames = {
            admin: "Quản Trị Viên",
            teacher: "Giảng Viên",
            student: "Học Viên"
        };
        const roleColors = {
            admin: "bg-purple-100 text-purple-700 border-purple-200",
            teacher: "bg-indigo-100 text-indigo-700 border-indigo-200",
            student: "bg-brand-100 text-brand-700 border-brand-200"
        };

        const shortName = user.full_name ? user.full_name.split(' ').pop() : "Học viên";
        const roleLabel = roleNames[user.role] || "Học Viên";
        const badgeColor = roleColors[user.role] || "bg-slate-100 text-slate-700";

        widget.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-primary font-bold text-xs uppercase overflow-hidden">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}&background=001e40&color=fff&size=64" class="w-full h-full object-cover"/>
            </div>
            <div class="flex flex-col">
                <span class="text-xs font-bold text-slate-900 leading-tight">${shortName}</span>
                <span class="text-[9px] px-1.5 py-0.5 mt-0.5 rounded border font-semibold ${badgeColor}">${roleLabel}</span>
            </div>
            <button id="supabase-widget-logout" class="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors ml-1" title="Đăng xuất tài khoản">
                <span class="material-symbols-outlined text-sm font-bold">logout</span>
            </button>
        `;
        document.body.appendChild(widget);

        // Đăng xuất
        document.getElementById('supabase-widget-logout').addEventListener('click', async () => {
            if (confirm("Bạn có chắc chắn muốn đăng xuất tài khoản online này không?")) {
                await supabase.auth.signOut();
                window.location.href = "auth.html";
            }
        });
    }

})();
