import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  
  const queryParams = new URLSearchParams(location.search);
  const initialMode = queryParams.get('mode') === 'signup' ? 'signup' : 'signin';
  
  const [mode, setMode] = useState(initialMode); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: 'error', message: '' });
  
  // Trạng thái kết nối Supabase để hỗ trợ chẩn đoán lỗi tại chỗ
  const [dbStatus, setDbStatus] = useState('checking'); // 'checking', 'connected', 'connected_missing_tables', 'error', 'unconfigured'
  const [dbError, setDbError] = useState('');

  // Tự động chuyển mode khi đường dẫn thay đổi
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'signup') {
      setMode('signup');
    } else if (modeParam === 'signin') {
      setMode('signin');
    }
  }, [location.search]);

  // Kiểm tra kết nối trực tiếp đến database khi mở trang đăng nhập
  useEffect(() => {
    const checkConnection = async () => {
      if (supabase.supabaseUrl === 'https://your-supabase-url.supabase.co' || !supabase.supabaseUrl) {
        setDbStatus('unconfigured');
        return;
      }
      try {
        const { data, error } = await supabase.from('courses').select('id').limit(1);
        if (error) {
          if (error.code === 'PGRST116' || error.code === '42P01') {
            setDbStatus('connected_missing_tables');
            setDbError(error.message);
          } else {
            setDbStatus('error');
            setDbError(error.message || JSON.stringify(error));
          }
        } else {
          setDbStatus('connected');
        }
      } catch (err) {
        setDbStatus('error');
        setDbError(err.message || 'Lỗi kết nối không xác định');
      }
    };
    checkConnection();
  }, []);

  // Nếu người dùng đã đăng nhập trước đó -> chuyển ngay về trang chủ
  useEffect(() => {
    if (session) {
      navigate('/');
    }
  }, [session, navigate]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert({ show: false, type: 'error', message: '' });

    try {
      if (mode === 'signup') {
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
        
        setAlert({
          show: true,
          type: 'success',
          message: "Đăng ký tài khoản online thành công! Bạn có thể đăng nhập ngay bây giờ."
        });
        setTimeout(() => {
          setMode('signin');
          setAlert({ show: false, type: 'error', message: '' });
        }, 1500);

      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) throw error;

        setAlert({
          show: true,
          type: 'success',
          message: "Đăng nhập thành công! Đang tải hệ thống..."
        });
        
        setTimeout(() => {
          navigate('/');
        }, 800);
      }
    } catch (err) {
      console.error(err);
      setAlert({
        show: true,
        type: 'error',
        message: err.message || "Lỗi xử lý đăng nhập trực tuyến!"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-[calc(100vh-64px)] flex flex-col justify-center items-center py-10 px-4 bg-slate-50 relative selection:bg-blue-600 selection:text-white">
      
      {/* Container */}
      <div class="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 shadow-md hover:shadow-lg transition-all">
        
        {/* Header */}
        <div class="text-center mb-6">
          <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-primary/10">
            <span class="material-symbols-outlined text-xl font-bold">school</span>
          </div>
          <h2 class="text-xl font-extrabold text-primary">
            {mode === 'signin' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
          </h2>
          <p class="text-slate-400 text-xs mt-1">
            {mode === 'signin' ? 'Kết nối trực tuyến với hệ thống Hannah English' : 'Bắt đầu lộ trình chinh phục chứng chỉ TOEIC & IELTS'}
          </p>

          {/* Hộp chỉ báo trạng thái kết nối Supabase */}
          <div class="mt-3 flex justify-center">
            {dbStatus === 'checking' && (
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 animate-pulse border border-slate-200">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                Đang kết nối Supabase...
              </span>
            )}
            {dbStatus === 'connected' && (
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 shadow-sm">
                <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-green-500 absolute"></span>
                Supabase: Đã kết nối ✅
              </span>
            )}
            {dbStatus === 'connected_missing_tables' && (
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-help" title={`Kết nối tốt nhưng bảng bị thiếu: ${dbError}. Hãy chạy file supabase_schema.sql trong Supabase Dashboard SQL Editor!`}>
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Supabase: Thiếu bảng (Chưa chạy SQL schema) ⚠️
              </span>
            )}
            {dbStatus === 'error' && (
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 cursor-help" title={`Lỗi kết nối: ${dbError}. Hãy kiểm tra lại key trong file .env và khởi động lại Vite!`}>
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                Supabase: Lỗi kết nối ❌
              </span>
            )}
            {dbStatus === 'unconfigured' && (
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-help" title="Bạn chưa cấu hình file .env hoặc chưa khởi động lại server Vite để nhận giá trị mới!">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                Supabase: Chưa cấu hình .env ⚠️
              </span>
            )}
          </div>
        </div>

        {/* Alert box */}
        {alert.show && (
          <div class={`mb-4 p-3 rounded-lg text-xs font-bold border flex items-start gap-2 ${alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            <span class="material-symbols-outlined text-sm shrink-0">
              {alert.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span>{alert.message}</span>
          </div>
        )}

        {/* Tab switcher */}
        <div class="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-5">
          <button 
            type="button"
            onClick={() => { setMode('signin'); setAlert({ show: false, type: 'error', message: '' }); }}
            class={`py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'signin' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Đăng Nhập
          </button>
          <button 
            type="button"
            onClick={() => { setMode('signup'); setAlert({ show: false, type: 'error', message: '' }); }}
            class={`py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Đăng Ký
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAuthSubmit} class="space-y-4">
          {mode === 'signup' && (
            <div>
              <label class="block text-[10px] font-bold text-primary mb-1 uppercase tracking-wide">Họ và Tên</label>
              <div class="relative">
                <span class="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">person</span>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  class="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-xs w-full" 
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>
            </div>
          )}

          <div>
            <label class="block text-[10px] font-bold text-primary mb-1 uppercase tracking-wide">Địa chỉ Email</label>
            <div class="relative">
              <span class="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">mail</span>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                class="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-xs w-full" 
                placeholder="name@domain.com"
              />
            </div>
          </div>

          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="block text-[10px] font-bold text-primary uppercase tracking-wide">Mật khẩu</label>
              <a href="#" class="text-[9px] font-bold text-slate-400 hover:text-primary hover:underline">Quên mật khẩu?</a>
            </div>
            <div class="relative">
              <span class="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">lock</span>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                class="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-xs w-full" 
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            class="w-full py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 disabled:opacity-75"
          >
            <span>{loading ? 'Đang xử lý...' : (mode === 'signin' ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản')}</span>
            {!loading && <span class="material-symbols-outlined text-sm">{mode === 'signin' ? 'arrow_forward' : 'person_add'}</span>}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Auth;
