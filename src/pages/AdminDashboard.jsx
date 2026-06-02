import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { createClient } from '@supabase/supabase-js';

const AdminDashboard = () => {
  const { user: currentUser } = useAuth();
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, courses
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [studentCourses, setStudentCourses] = useState([]);
  const [examsCount, setExamsCount] = useState(0);
  
  // Loading and search
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState(null);

  // Modal states for creating/editing users and courses (Thay thế cho window.prompt mặc định)
  const [modalType, setModalType] = useState(null); // 'create_user', 'edit_user', 'create_course', 'edit_course'
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  
  // Form states - User
  const [userForm, setUserForm] = useState({ id: '', fullName: '', email: '', password: '' });
  
  // Form states - Course
  const [courseForm, setCourseForm] = useState({ id: '', title: '', code: '', description: '' });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchInitialData = async () => {
    await fetchSystemCourses();
    await fetchStudentCoursesMapping();
    await fetchUsersList();
    await fetchExamsCount();
  };

  // 1. Fetch system courses
  const fetchSystemCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('title', { ascending: true });
      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách khóa học:", err);
    }
  };

  // 2. Fetch student courses mapping
  const fetchStudentCoursesMapping = async () => {
    try {
      const { data, error } = await supabase
        .from('student_courses')
        .select('*');
      if (error) throw error;
      setStudentCourses(data || []);
    } catch (err) {
      console.error("Lỗi lấy phân quyền học viên:", err);
    }
  };

  // 3. Fetch users list
  const fetchUsersList = async () => {
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách người dùng:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 4. Fetch total exams count
  const fetchExamsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('exams')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      setExamsCount(count || 0);
    } catch (err) {
      console.error("Lỗi lấy số lượng đề thi:", err);
    }
  };

  // ==========================================
  // COURSES CRUD ACTIONS
  // ==========================================
  const handleCreateCourse = () => {
    setCourseForm({ id: '', title: '', code: '', description: '' });
    setModalError('');
    setModalType('create_course');
  };

  const submitCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.title.trim() || !courseForm.code.trim()) {
      setModalError("Vui lòng nhập đầy đủ Tên và Mã khóa học!");
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const { error } = await supabase
        .from('courses')
        .insert({
          title: courseForm.title.trim(),
          code: courseForm.code.trim().toLowerCase(),
          description: courseForm.description ? courseForm.description.trim() : null
        });

      if (error) throw error;

      showToast("Đã thêm khóa học mới thành công!");
      setModalType(null);
      fetchSystemCourses();
    } catch (err) {
      console.error("Lỗi thêm khóa học:", err);
      setModalError("Không thể thêm khóa học: " + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditCourse = (course) => {
    setCourseForm({
      id: course.id,
      title: course.title,
      code: course.code,
      description: course.description || ''
    });
    setModalError('');
    setModalType('edit_course');
  };

  const submitEditCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.title.trim()) {
      setModalError("Vui lòng nhập Tên khóa học!");
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          title: courseForm.title.trim(),
          description: courseForm.description ? courseForm.description.trim() : null
        })
        .eq('id', courseForm.id);

      if (error) throw error;

      showToast("Đã cập nhật thông tin khóa học!");
      setModalType(null);
      fetchSystemCourses();
    } catch (err) {
      console.error("Lỗi cập nhật khóa học:", err);
      setModalError("Lỗi cập nhật khóa học: " + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId, courseTitle) => {
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
      fetchSystemCourses();
    } catch (err) {
      console.error("Lỗi xóa khóa học:", err);
      alert("Không thể xóa khóa học: " + err.message);
    }
  };

  // ==========================================
  // USERS ACTIONS
  // ==========================================
  const handleCreateUser = () => {
    setUserForm({ id: '', fullName: '', email: '', password: '' });
    setModalError('');
    setModalType('create_user');
  };

  const submitCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.fullName.trim() || !userForm.email.trim() || !userForm.password) {
      setModalError("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    if (userForm.password.length < 6) {
      setModalError("Mật khẩu phải tối thiểu 6 ký tự!");
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      // Khởi tạo một client phụ tạm thời không lưu Session vào LocalStorage
      // Điều này ngăn chặn việc Supabase tự động đăng xuất Admin và chuyển sang tài khoản mới tạo!
      const tempSupabase = createClient(
        supabase.supabaseUrl,
        supabase.supabaseKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      const { error } = await tempSupabase.auth.signUp({
        email: userForm.email.trim(),
        password: userForm.password,
        options: {
          data: {
            full_name: userForm.fullName.trim()
          }
        }
      });

      if (error) throw error;

      showToast(`Đã tạo tài khoản cho ${userForm.fullName} thành công!`);
      setModalType(null);
      fetchUsersList();
    } catch (err) {
      console.error("Lỗi tạo người dùng:", err);
      setModalError("Lỗi tạo người dùng: " + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditUserFullName = (userId, currentName) => {
    setUserForm({ id: userId, fullName: currentName, email: '', password: '' });
    setModalError('');
    setModalType('edit_user');
  };

  const submitEditUserFullName = async (e) => {
    e.preventDefault();
    if (!userForm.fullName.trim()) {
      setModalError("Vui lòng nhập Họ và tên mới!");
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: userForm.fullName.trim() })
        .eq('id', userForm.id);

      if (error) throw error;

      showToast("Đã sửa họ tên người dùng thành công!");
      setModalType(null);
      fetchUsersList();
    } catch (err) {
      console.error("Lỗi sửa họ tên:", err);
      setModalError("Lỗi sửa tên: " + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      
      showToast("Đã cập nhật vai trò thành công!");
      fetchUsersList();
    } catch (err) {
      console.error("Lỗi cập nhật vai trò:", err);
      alert("Lỗi cập nhật vai trò: " + err.message);
    }
  };

  const handleToggleCoursePermission = async (studentId, courseId, isChecked) => {
    try {
      if (isChecked) {
        const { error } = await supabase
          .from('student_courses')
          .insert({
            student_id: studentId,
            course_id: courseId
          });
        if (error) throw error;
        showToast("Đã cấp quyền truy cập khóa học!");
      } else {
        const { error } = await supabase
          .from('student_courses')
          .delete()
          .eq('student_id', studentId)
          .eq('course_id', courseId);
        if (error) throw error;
        showToast("Đã gỡ quyền truy cập khóa học!");
      }
      fetchStudentCoursesMapping();
    } catch (err) {
      console.error("Lỗi phân quyền khóa học:", err);
      alert("Lỗi phân quyền: " + err.message);
    }
  };

  const handleDeleteUserAccount = async (userId, fullName) => {
    if (userId === currentUser?.id) {
      alert("Bạn không thể tự xóa tài khoản của chính mình!");
      return;
    }

    if (!confirm(`⚠️ Bạn có chắc muốn xóa vĩnh viễn tài khoản của ${fullName}?\nTất cả kết quả thi và phân quyền liên quan cũng sẽ bị xóa bỏ.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      showToast("Đã xóa tài khoản thành công!");
      fetchUsersList();
    } catch (err) {
      console.error("Lỗi xóa tài khoản:", err);
      alert("Không thể xóa tài khoản: " + err.message);
    }
  };

  // Filters and metrics
  const filteredUsers = users.filter(u => {
    const q = userSearchQuery.toLowerCase();
    const name = u.full_name || '';
    const email = u.email || '';
    const role = u.role || '';
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || role.toLowerCase().includes(q);
  });

  const studentsCount = users.filter(u => u.role === 'student').length;
  const teachersCount = users.filter(u => u.role === 'teacher').length;

  return (
    <div className="bg-[#f8f9fa] min-h-screen text-slate-800 flex flex-col md:flex-row pb-12">
      
      {/* Sidebar navigation */}
      <aside className="w-full md:w-64 bg-[#001e40] text-white flex flex-col shrink-0">
        <div className="p-6 h-16 flex items-center border-b border-white/10 shrink-0">
          <span className="material-symbols-outlined text-blue-400 text-2xl mr-2">school</span>
          <span className="font-display font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
            EduMetrics Admin
          </span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-350 hover:bg-white/5 hover:text-white'}`}
          >
            <span className="material-symbols-outlined text-sm font-bold">dashboard</span>
            <span>Tổng quan</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-350 hover:bg-white/5 hover:text-white'}`}
          >
            <span className="material-symbols-outlined text-sm font-bold">group</span>
            <span>Quản lý người dùng</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('courses')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'courses' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-350 hover:bg-white/5 hover:text-white'}`}
          >
            <span className="material-symbols-outlined text-sm font-bold">school</span>
            <span>Quản lý khóa học</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
            <div className="w-8 h-8 rounded-full bg-blue-650 flex items-center justify-center font-bold text-xs uppercase text-white shrink-0 border border-white/20">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-white">{currentUser?.full_name}</p>
              <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider block">Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        
        {/* VIEW: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-1">
              <h2 className="font-display text-2xl font-extrabold text-[#001e40]">Tổng quan Hệ thống</h2>
              <p className="text-slate-500 text-xs">Phân tích tổng thể dữ liệu sử dụng và lưu lượng truy cập khóa học online.</p>
            </div>

            {/* Stat Cards Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">Tổng người dùng</span>
                  <span className="material-symbols-outlined text-blue-600 bg-blue-50 p-2 rounded-xl text-lg font-bold">groups</span>
                </div>
                <div className="mt-6">
                  <h3 className="text-2xl font-extrabold text-[#001e40]">{users.length}</h3>
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">▲ Hoạt động trực tuyến</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">Tổng học viên</span>
                  <span className="material-symbols-outlined text-indigo-600 bg-indigo-50 p-2 rounded-xl text-lg font-bold">person_play</span>
                </div>
                <div className="mt-6">
                  <h3 className="text-2xl font-extrabold text-[#001e40]">{studentsCount}</h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">Đã cấp quyền học tập</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-purple-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">Khóa học hiện có</span>
                  <span className="material-symbols-outlined text-purple-600 bg-purple-50 p-2 rounded-xl text-lg font-bold">book</span>
                </div>
                <div className="mt-6">
                  <h3 className="text-2xl font-extrabold text-[#001e40]">{courses.length}</h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">TOEIC & IELTS chủ đạo</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-pink-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">Đề thi đã soạn</span>
                  <span className="material-symbols-outlined text-pink-600 bg-pink-50 p-2 rounded-xl text-lg font-bold">quiz</span>
                </div>
                <div className="mt-6">
                  <h3 className="text-2xl font-extrabold text-[#001e40]">{examsCount}</h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">Bài thi thử trọn vẹn</p>
                </div>
              </div>
            </section>

            {/* Visual Charts and Resources */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Traffic/Usage Graph */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-display font-bold text-sm text-[#001e40]">Tương tác hệ thống (7 ngày gần nhất)</h3>
                  <span className="text-[10px] font-extrabold text-blue-650 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-lg">Realtime</span>
                </div>
                
                <div className="h-60 w-full flex items-end justify-between px-2 gap-4 pb-2">
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full bg-blue-600/10 rounded-t-lg transition-all hover:bg-blue-600/20" style={{ height: "45%" }}></div>
                    <span className="text-[10px] font-bold text-slate-400">Th2</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full bg-blue-600/10 rounded-t-lg transition-all hover:bg-blue-600/20" style={{ height: "60%" }}></div>
                    <span className="text-[10px] font-bold text-slate-400">Th3</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full bg-[#001e40] rounded-t-lg transition-all hover:bg-[#003366]" style={{ height: "85%" }}></div>
                    <span className="text-[10px] font-bold text-[#001e40]">Th4</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full bg-blue-600/10 rounded-t-lg transition-all hover:bg-blue-600/20" style={{ height: "70%" }}></div>
                    <span className="text-[10px] font-bold text-slate-400">Th5</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full bg-blue-600/10 rounded-t-lg transition-all hover:bg-blue-600/20" style={{ height: "55%" }}></div>
                    <span className="text-[10px] font-bold text-slate-400">Th6</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full bg-blue-600/10 rounded-t-lg transition-all hover:bg-blue-600/20" style={{ height: "30%" }}></div>
                    <span className="text-[10px] font-bold text-slate-400">Th7</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full bg-blue-600/10 rounded-t-lg transition-all hover:bg-blue-600/20" style={{ height: "40%" }}></div>
                    <span className="text-[10px] font-bold text-slate-400">CN</span>
                  </div>
                </div>
              </div>

              {/* Resources list */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-display font-bold text-sm text-[#001e40]">Quản lý Tài nguyên</h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-500/20 hover:bg-slate-100/30 transition-all cursor-pointer group">
                    <span className="material-symbols-outlined text-blue-650 bg-blue-50 p-2 rounded-xl text-base">picture_as_pdf</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 truncate">Thư viện PDF Học liệu</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">1,240 tệp tin IELTS / TOEIC</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-500/20 hover:bg-slate-100/30 transition-all cursor-pointer group">
                    <span className="material-symbols-outlined text-indigo-650 bg-indigo-50 p-2 rounded-xl text-base">video_library</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 truncate">Kho Video Học Tập</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">320 giờ bài giảng lý thuyết</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-purple-500/20 hover:bg-slate-100/30 transition-all cursor-pointer group">
                    <span className="material-symbols-outlined text-purple-650 bg-purple-50 p-2 rounded-xl text-base">quiz</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 truncate">Ngân hàng đề thi</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">5,000+ câu hỏi tự chấm</p>
                    </div>
                  </div>
                </div>
              </div>

            </section>
          </div>
        )}

        {/* VIEW: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-[#001e40]">Quản Lý Tài Khoản & Phân Quyền</h2>
                <p className="text-slate-500 text-xs">Cấp quyền học tập IELTS/TOEIC, phân chia vai trò thành viên và quản lý hồ sơ người dùng.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input 
                    type="text" 
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Tìm thành viên..."
                    className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl w-60 focus:outline-none focus:border-blue-650 bg-white font-medium"
                  />
                </div>
                <button 
                  onClick={handleCreateUser}
                  className="bg-[#001e40] hover:bg-[#003366] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm font-bold">person_add</span>
                  <span>Thêm tài khoản</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-150 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Họ và tên</th>
                      <th className="px-6 py-4">Vai trò</th>
                      <th className="px-6 py-4">Khóa học được cấp quyền</th>
                      <th className="px-6 py-4">Trạng thái</th>
                      <th className="px-6 py-4 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan="5" className="text-center py-12 text-slate-400">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Đang tải hồ sơ từ Supabase...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-12 text-slate-450">
                          Không tìm thấy người dùng nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => {
                        const initials = u.full_name ? u.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
                        const assignedIds = studentCourses.filter(sc => sc.student_id === u.id).map(sc => sc.course_id);

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-blue-650 flex items-center justify-center font-bold text-[10px] shrink-0 uppercase">
                                  {initials}
                                </div>
                                <div>
                                  <p className="font-bold text-[#001e40]">{u.full_name || 'Thành viên mới'}</p>
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            
                            <td className="px-6 py-4">
                              <select 
                                value={u.role || 'student'} 
                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                className="text-xs font-bold rounded-xl border border-slate-200 py-1.5 px-2 focus:outline-none focus:border-blue-650 text-slate-700 bg-white cursor-pointer"
                              >
                                <option value="student">Học viên</option>
                                <option value="teacher">Giảng viên</option>
                                <option value="admin">Quản trị viên</option>
                              </select>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {u.role === 'student' ? (
                                  courses.map(c => {
                                    const isAssigned = assignedIds.includes(c.id);
                                    return (
                                      <label key={c.id} className={`inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-bold uppercase select-none cursor-pointer transition-all ${isAssigned ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-slate-550'}`}>
                                        <input 
                                          type="checkbox" 
                                          checked={isAssigned}
                                          onChange={(e) => handleToggleCoursePermission(u.id, c.id, e.target.checked)}
                                          className="rounded border-slate-300 text-blue-650 focus:ring-blue-650 w-3 h-3 cursor-pointer"
                                        />
                                        <span>{c.title.split(' ')[0]}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Quyền quản trị toàn bộ tài nguyên</span>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <span className="flex items-center gap-1.5 text-emerald-600 text-[10px] uppercase font-bold tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hoạt động
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button 
                                  onClick={() => handleEditUserFullName(u.id, u.full_name)}
                                  className="p-1.5 text-slate-400 hover:text-blue-650 hover:bg-slate-100 rounded-lg transition-all"
                                  title="Chỉnh sửa tên"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button 
                                  onClick={() => handleDeleteUserAccount(u.id, u.full_name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Xóa tài khoản"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-150 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-400">
                <p>Hiển thị 1-{filteredUsers.length} trong số {filteredUsers.length} tài khoản</p>
              </div>
            </section>
          </div>
        )}

        {/* VIEW: COURSES */}
        {activeTab === 'courses' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-[#001e40]">Quản Lý Khóa Học Hệ Thống</h2>
                <p className="text-slate-500 text-xs">Cấu hình danh mục khóa học, mã quyền truy cập khóa học TOEIC/IELTS chính.</p>
              </div>

              <button 
                onClick={handleCreateCourse}
                className="bg-[#001e40] hover:bg-[#003366] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                <span>Thêm khóa học</span>
              </button>
            </div>

            {/* Courses Table */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-150 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Tên khóa học</th>
                      <th className="px-6 py-4">Mã khóa học (unique)</th>
                      <th className="px-6 py-4">Mô tả khóa học</th>
                      <th className="px-6 py-4 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                    {courses.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-[#001e40]">{c.title}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-mono rounded text-[10px] font-bold">
                            {c.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 max-w-sm truncate" title={c.description || ''}>
                          {c.description || 'Chưa cập nhật mô tả'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button 
                              onClick={() => handleEditCourse(c)}
                              className="p-1.5 text-slate-400 hover:text-blue-650 hover:bg-slate-100 rounded-lg transition-all"
                              title="Chỉnh sửa khóa học"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteCourse(c.id, c.title)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Xóa khóa học"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {courses.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-12 text-slate-450">
                          Chưa có khóa học nào được cấu hình trên hệ thống.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

      </main>

      {/* ======================================================== */}
      {/* BỘ MODAL QUẢN TRỊ TÙY BIẾN CAO CẤP (CUSTOM ADMIN MODALS) */}
      {/* ======================================================== */}
      {modalType && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#001e40]/55 backdrop-blur-sm transition-all duration-300">
          
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-md w-full p-6 relative overflow-hidden transition-all duration-300 transform scale-100">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-display font-extrabold text-sm text-[#001e40] flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-lg">
                  {modalType === 'create_user' && 'person_add'}
                  {modalType === 'edit_user' && 'manage_accounts'}
                  {modalType === 'create_course' && 'library_add'}
                  {modalType === 'edit_course' && 'edit_note'}
                </span>
                <span>
                  {modalType === 'create_user' && 'Thêm Thành Viên Mới'}
                  {modalType === 'edit_user' && 'Chỉnh Sửa Họ & Tên'}
                  {modalType === 'create_course' && 'Tạo Khóa Học Mới'}
                  {modalType === 'edit_course' && 'Chỉnh Sửa Khóa Học'}
                </span>
              </h3>
              <button 
                onClick={() => setModalType(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            </div>

            {/* Modal Error Alert */}
            {modalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-start gap-2">
                <span className="material-symbols-outlined text-sm shrink-0">error</span>
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Body / Forms */}
            <form onSubmit={
              modalType === 'create_user' ? submitCreateUser :
              modalType === 'edit_user' ? submitEditUserFullName :
              modalType === 'create_course' ? submitCreateCourse :
              submitEditCourse
            } className="space-y-4">
              
              {/* FORM: CREATE USER */}
              {modalType === 'create_user' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Họ và Tên</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">person</span>
                      <input 
                        type="text"
                        required
                        value={userForm.fullName}
                        onChange={e => setUserForm({ ...userForm, fullName: e.target.value })}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium"
                        placeholder="Ví dụ: Nguyễn Văn A"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Địa chỉ Email</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">mail</span>
                      <input 
                        type="email"
                        required
                        value={userForm.email}
                        onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mật khẩu khởi tạo</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">lock</span>
                      <input 
                        type="password"
                        required
                        value={userForm.password}
                        onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium"
                        placeholder="Tối thiểu 6 ký tự"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* FORM: EDIT USER NAME */}
              {modalType === 'edit_user' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Họ và Tên Mới</label>
                  <div className="relative">
                    <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">person</span>
                    <input 
                      type="text"
                      required
                      value={userForm.fullName}
                      onChange={e => setUserForm({ ...userForm, fullName: e.target.value })}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium"
                      placeholder="Nhập họ tên đầy đủ"
                    />
                  </div>
                </div>
              )}

              {/* FORM: CREATE COURSE */}
              {modalType === 'create_course' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tên khóa học</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">menu_book</span>
                      <input 
                        type="text"
                        required
                        value={courseForm.title}
                        onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium"
                        placeholder="Ví dụ: IELTS Masterclass 6.5+"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mã code độc nhất</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">qr_code</span>
                      <input 
                        type="text"
                        required
                        value={courseForm.code}
                        onChange={e => setCourseForm({ ...courseForm, code: e.target.value })}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium font-mono"
                        placeholder="Ví dụ: ielts_65, toeic_master"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mô tả tóm tắt</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-2.5">description</span>
                      <textarea 
                        value={courseForm.description}
                        onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium min-h-[80px]"
                        placeholder="Mô tả mục tiêu, đối tượng khóa học..."
                      />
                    </div>
                  </div>
                </>
              )}

              {/* FORM: EDIT COURSE */}
              {modalType === 'edit_course' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tên khóa học</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">menu_book</span>
                      <input 
                        type="text"
                        required
                        value={courseForm.title}
                        onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium"
                        placeholder="Tên khóa học"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mô tả khóa học</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-2.5">description</span>
                      <textarea 
                        value={courseForm.description}
                        onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs w-full font-medium min-h-[80px]"
                        placeholder="Mô tả khóa học"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button 
                  type="button"
                  disabled={modalLoading}
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 font-bold rounded-xl text-xs uppercase tracking-wide transition-all disabled:opacity-50"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all shadow-md active:scale-97 flex items-center gap-1.5 disabled:opacity-80"
                >
                  {modalLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xs">done</span>
                      <span>Xác nhận</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[99999] bg-[#001e40] text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-2 transition-all duration-300 animate-slide-in">
          <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
