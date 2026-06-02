import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();

  // 1. Đang tải Auth State -> Hiển thị spinner
  if (loading) {
    return (
      <div class="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs font-semibold text-slate-450 uppercase tracking-widest animate-pulse">Hannah English Security...</p>
      </div>
    );
  }

  // 2. Chưa đăng nhập -> Chuyển hướng về trang đăng nhập
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Đã đăng nhập nhưng không có quyền phù hợp -> Chuyển về trang học viên mặc định
  if (allowedRoles && !allowedRoles.includes(role)) {
    alert("⚠️ Bạn không có quyền truy cập trang này!");
    return <Navigate to="/student" replace />;
  }

  // 4. Hợp lệ -> Cho phép truy cập
  return children;
};

export default PrivateRoute;
