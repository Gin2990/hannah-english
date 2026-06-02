import React from 'react';

const Footer = () => {
  return (
    <footer class="bg-slate-50 border-t border-slate-200 py-6 mt-auto">
      <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-550">
        <div>
          <h4 class="font-bold text-primary mb-1">Hannah English & EduMetrics</h4>
          <p>© 2026 Hannah English Portal. Bản quyền được bảo lưu.</p>
        </div>
        <div class="flex gap-4">
          <a href="#" class="hover:underline">Về chúng tôi</a>
          <a href="#" class="hover:underline">Điều khoản sử dụng</a>
          <a href="#" class="hover:underline">Chính sách bảo mật</a>
          <a href="#" class="hover:underline">Hỗ trợ</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
