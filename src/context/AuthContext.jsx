import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const userLoadedRef = useRef(false);
  const currentUserRef = useRef(null);

  useEffect(() => {
    // 1. Lấy Session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // 2. Lắng nghe thay đổi trạng thái đăng nhập bảo mật
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        // Chỉ nạp lại hồ sơ nếu chưa có thông tin user hoặc ID người dùng thay đổi
        const currentUserId = currentUserRef.current?.id;
        if (!currentUserId || currentUserId !== session.user.id) {
          fetchUserProfile(session.user);
        }
      } else {
        // Chỉ xử lý SIGNED_OUT thực sự để tránh mất phiên tạm thời do mạng/refocus
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setRole(null);
          setLoading(false);
          userLoadedRef.current = false;
          currentUserRef.current = null;
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Truy vấn hồ sơ người dùng để lấy Role chính xác
  const fetchUserProfile = async (authUser) => {
    // Chỉ kích hoạt trạng thái loading chặn màn hình nếu chưa có thông tin user (lần tải đầu)
    const isInitialLoad = !userLoadedRef.current;
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) throw error;

      if (profile) {
        setUser(profile);
        setRole(profile.role);
        currentUserRef.current = profile;
      } else {
        // Fallback nếu profile chưa được tạo kịp thời do lỗi đồng bộ
        const fallback = {
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || 'Thành viên mới',
          role: 'student'
        };
        setUser(fallback);
        setRole('student');
        currentUserRef.current = fallback;
      }
      userLoadedRef.current = true;
    } catch (err) {
      console.error("Lỗi lấy thông tin vai trò người dùng:", err);
      // Fallback
      const fallback = {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || 'Thành viên mới',
        role: 'student'
      };
      setUser(fallback);
      setRole('student');
      currentUserRef.current = fallback;
      userLoadedRef.current = true;
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setSession(null);
    userLoadedRef.current = false;
    currentUserRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, logout, refreshUser: () => session && fetchUserProfile(session.user) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
