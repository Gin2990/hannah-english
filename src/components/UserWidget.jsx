import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const UserWidget = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const roleNames = {
    admin: "Quản Trị Viên",
    teacher: "Giảng Viên",
    student: "Học Viên"
  };

  const roleColors = {
    admin: "bg-purple-100 text-purple-700 border-purple-200",
    teacher: "bg-indigo-100 text-indigo-700 border-indigo-200",
    student: "bg-blue-100 text-blue-700 border-blue-200"
  };

  const shortName = user.full_name ? user.full_name.split(' ').pop() : "Học viên";
  const roleLabel = roleNames[user.role] || "Học Viên";
  const badgeColor = roleColors[user.role] || "bg-slate-100 text-slate-700";

  const handleLogoutClick = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất tài khoản online này không?")) {
      logout();
      navigate('/auth');
    }
  };

  return (
    <div id="supabase-user-widget" class="fixed bottom-4 left-4 z-[9999] bg-white text-slate-800 border border-slate-200 p-3 rounded-xl shadow-lg flex items-center gap-3 transition-all hover:shadow-xl hover:scale-102">
      <div class="w-8 h-8 rounded-full bg-slate-150 border border-slate-200 flex items-center justify-center text-primary font-bold text-xs uppercase overflow-hidden">
        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}&background=001e40&color=fff&size=64`} class="w-full h-full object-cover" alt="User avatar" />
      </div>
      <div class="flex flex-col">
        <span class="text-xs font-bold text-slate-900 leading-tight">{shortName}</span>
        <span class="text-[9px] px-1.5 py-0.5 mt-0.5 rounded border font-semibold inline-block w-fit leading-none">{roleLabel}</span>
      </div>
      <button 
        onClick={handleLogoutClick}
        class="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors ml-1" 
        title="Đăng xuất tài khoản"
      >
        <span class="material-symbols-outlined text-sm font-bold">logout</span>
      </button>
    </div>
  );
};

export default UserWidget;
