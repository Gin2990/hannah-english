import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleAuthAction = () => {
    if (user) {
      if (window.confirm("Bạn có chắc muốn đăng xuất không?")) {
        logout();
        navigate('/auth');
      }
    } else {
      navigate('/auth');
    }
  };

  const getDashboardLink = () => {
    if (!role) return '/';
    if (role === 'admin') return '/admin';
    if (role === 'teacher') return '/teacher';
    return '/student';
  };

  return (
    <header class="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div class="flex justify-between items-center w-full px-6 max-w-[1440px] mx-auto h-16">
        <div class="flex items-center gap-6">
          <Link to={getDashboardLink()} class="font-bold text-lg text-primary tracking-tight flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-2xl font-bold">school</span>
            <span>Hannah English</span>
          </Link>
          
          <nav class="hidden md:flex items-center gap-6">
            <NavLink to="/practice" className={({ isActive }) => `text-xs font-semibold pb-1 border-b-2 transition-all ${isActive ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Ôn luyện</NavLink>
            <NavLink to="/mock-tests" className={({ isActive }) => `text-xs font-semibold pb-1 border-b-2 transition-all ${isActive ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Thi thử</NavLink>

            {user && role === 'student' && (
              <>
                <NavLink to="/student" end className={({ isActive }) => `text-xs font-semibold pb-1 border-b-2 transition-all ${isActive ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Bảng học tập</NavLink>
                <NavLink to="/profile" className={({ isActive }) => `text-xs font-semibold pb-1 border-b-2 transition-all ${isActive ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Hồ sơ</NavLink>
              </>
            )}
            
            {user && role === 'teacher' && (
              <>
                <NavLink to="/teacher" end className={({ isActive }) => `text-xs font-semibold pb-1 border-b-2 transition-all ${isActive ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Cổng giảng dạy</NavLink>
                <NavLink to="/teacher/converter" className={({ isActive }) => `text-xs font-semibold pb-1 border-b-2 transition-all ${isActive ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Bộ Convert & Preview</NavLink>
              </>
            )}

            {user && role === 'admin' && (
              <>
                <NavLink to="/admin" end className={({ isActive }) => `text-xs font-semibold pb-1 border-b-2 transition-all ${isActive ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Trang quản trị</NavLink>
                <NavLink to="/teacher/converter" className={({ isActive }) => `text-xs font-semibold pb-1 border-b-2 transition-all ${isActive ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Bộ Convert & Preview</NavLink>
              </>
            )}
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <div class="relative hidden sm:block">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input class="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary text-xs w-48" placeholder="Tìm kiếm..." type="text"/>
          </div>
          
          <button 
            onClick={handleAuthAction}
            class="bg-primary text-white px-4 py-1.5 rounded-lg font-semibold text-xs hover:bg-primary-container transition-all active:scale-95 shadow-sm"
          >
            {user ? 'Đăng xuất' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
