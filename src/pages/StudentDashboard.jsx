import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [allowedCourses, setAllowedCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchAllowedCourses();
      fetchRecentAttempts();
    }
  }, [user]);

  // 1. Fetch allowed courses
  const fetchAllowedCourses = async () => {
    try {
      setLoadingCourses(true);
      const { data, error } = await supabase
        .from('student_courses')
        .select(`
          course_id,
          courses (
            code
          )
        `)
        .eq('student_id', user.id);

      if (error) throw error;

      const codes = data.map(item => item.courses?.code?.toLowerCase()).filter(Boolean);
      setAllowedCourses(codes);
    } catch (err) {
      console.error("Lỗi lấy danh sách khóa học của học viên:", err);
      setAllowedCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  // 2. Fetch recent test attempts
  const fetchRecentAttempts = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_results')
        .select(`
          score,
          total_questions,
          taken_at,
          exams (
            title,
            course_id,
            courses (
              code
            )
          )
        `)
        .eq('student_id', user.id)
        .order('taken_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentAttempts(data || []);
    } catch (err) {
      console.error("Lỗi lấy lịch sử thi của học sinh:", err);
    }
  };

  const handleCourseClick = (courseCode) => {
    const isAllowed = allowedCourses.includes(courseCode);
    if (!isAllowed) {
      alert(`🔒 Khóa học này chưa được phân quyền cho bạn!\nVui lòng liên hệ Giáo viên hoặc Admin để được cấp quyền học tập.`);
      return;
    }

    if (courseCode === 'toeic') {
      navigate('/practice');
    } else if (courseCode === 'ielts') {
      navigate('/mock-tests');
    }
  };

  const ieltsAllowed = allowedCourses.includes('ielts');
  const toeicAllowed = allowedCourses.includes('toeic');

  // Welcome naming split
  const firstName = user?.full_name ? user.full_name.split(' ').pop() : 'Học viên';

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] min-h-[calc(100vh-64px)] flex flex-col font-sans">
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 py-12 space-y-8 animate-fade-in">
        
        {/* Welcome Section */}
        <section className="mb-6 space-y-1">
          <h1 className="font-display font-extrabold text-3xl text-[#001e40] leading-none mb-1">
            Chào buổi sáng, {firstName}!
          </h1>
          <p className="text-[#5d5e5f] text-sm leading-relaxed">
            Bạn đã hoàn thành 75% mục tiêu học tập tuần này. Hãy tiếp tục nhé!
          </p>
        </section>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Courses & Quick Actions (col-span-8) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            
            {/* Recent Activity Shortcut */}
            <div className="bg-[#003366] p-6 rounded-2xl border border-[#c3c6d1] flex flex-col md:flex-row justify-between items-center gap-4 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-[-10px] top-[-10px] w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined text-3xl font-bold">play_circle</span>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-1">Hoạt động gần đây</h3>
                  <p className="font-display font-extrabold text-sm sm:text-base">IELTS Reading: Matching Headings</p>
                </div>
              </div>
              <button 
                onClick={() => handleCourseClick('ielts')}
                className="bg-white text-[#001e40] font-bold px-6 py-2.5 rounded-xl text-xs hover:bg-[#edeeef] transition-all active:scale-95 shadow-sm shrink-0"
              >
                Tiếp tục ngay
              </button>
            </div>

            {/* My Courses Section */}
            <div className="space-y-4">
              <h2 className="font-display font-extrabold text-lg text-[#001e40] mb-4">Khóa học của tôi</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* IELTS Card */}
                <div 
                  onClick={() => handleCourseClick('ielts')}
                  className={`p-6 border border-[#c3c6d1] rounded-2xl flex flex-col justify-between h-56 transition-all relative overflow-hidden ${ieltsAllowed ? 'cursor-pointer hover:border-[#001e40] hover:shadow-lg' : 'opacity-65 select-none bg-[#f3f4f5]'}`}
                  style={{
                    background: ieltsAllowed ? 'linear-gradient(135deg, rgba(0, 30, 64, 0.03) 0%, rgba(255, 255, 255, 1) 100%)' : '#f3f4f5'
                  }}
                >
                  {!ieltsAllowed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/5 backdrop-blur-[0.5px] z-20 gap-1.5 select-none pointer-events-none">
                      <span className="material-symbols-outlined text-red-500 text-2xl font-bold">lock</span>
                      <span className="text-red-700 bg-red-50 border border-red-150 px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold">Chưa phân quyền</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-[#001e40] border border-[#c3c6d1]">
                      <span className="material-symbols-outlined text-4xl">menu_book</span>
                    </div>
                    <span className="bg-[#d5e3ff] text-[#001b3c] text-[10px] font-extrabold px-3 py-1 rounded-lg uppercase tracking-wide">Academic</span>
                  </div>

                  <div>
                    <h3 className="font-display font-extrabold text-[#001e40] text-base sm:text-lg mb-1">IELTS Masterclass</h3>
                    <p className="text-[#5d5e5f] text-xs leading-relaxed line-clamp-2">Hệ thống luyện thi 4 kỹ năng chuyên sâu bám sát chuẩn IDP & BC.</p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-[10px] font-bold text-[#5d5e5f]">
                      <span>Tiến độ</span>
                      <span>{ieltsAllowed ? "65%" : "0%"}</span>
                    </div>
                    <div className="h-2 w-full bg-[#e1e3e4] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#001e40] rounded-full transition-all duration-1000" 
                        style={{ width: ieltsAllowed ? "65%" : "0%" }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* TOEIC Card */}
                <div 
                  onClick={() => handleCourseClick('toeic')}
                  className={`p-6 border border-[#c3c6d1] rounded-2xl flex flex-col justify-between h-56 transition-all relative overflow-hidden ${toeicAllowed ? 'cursor-pointer hover:border-[#001e40] hover:shadow-lg' : 'opacity-65 select-none bg-[#f3f4f5]'}`}
                  style={{
                    background: toeicAllowed ? 'linear-gradient(135deg, rgba(0, 30, 64, 0.03) 0%, rgba(255, 255, 255, 1) 100%)' : '#f3f4f5'
                  }}
                >
                  {!toeicAllowed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/5 backdrop-blur-[0.5px] z-20 gap-1.5 select-none pointer-events-none">
                      <span className="material-symbols-outlined text-red-500 text-2xl font-bold">lock</span>
                      <span className="text-red-700 bg-red-50 border border-red-150 px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold">Chưa phân quyền</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-[#001e40] border border-[#c3c6d1]">
                      <span className="material-symbols-outlined text-4xl">business_center</span>
                    </div>
                    <span className="bg-[#e0dfdf] text-[#626363] text-[10px] font-extrabold px-3 py-1 rounded-lg uppercase tracking-wide">Professional</span>
                  </div>

                  <div>
                    <h3 className="font-display font-extrabold text-[#001e40] text-base sm:text-lg mb-1">TOEIC 800+ Target</h3>
                    <p className="text-[#5d5e5f] text-xs leading-relaxed line-clamp-2">Chiến thuật giải đề đọc hiểu, nghe và từ vựng thương mại chuyên nghiệp.</p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-[10px] font-bold text-[#5d5e5f]">
                      <span>Tiến độ</span>
                      <span>{toeicAllowed ? "42%" : "0%"}</span>
                    </div>
                    <div className="h-2 w-full bg-[#e1e3e4] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#001e40] rounded-full transition-all duration-1000" 
                        style={{ width: toeicAllowed ? "42%" : "0%" }}
                      ></div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Grade History & Upcoming Calendar (col-span-4) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            
            {/* Grade History */}
            <div className="bg-white p-6 border border-[#c3c6d1] rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-xs uppercase tracking-widest text-[#001e40]">Lịch sử điểm số</h3>
                <Link to="/profile" className="text-[#001e40] font-bold text-xs hover:underline">Chi tiết</Link>
              </div>
              
              <div className="space-y-4">
                {recentAttempts.map((attempt, idx) => {
                  const accuracy = attempt.total_questions > 0 ? Math.round((attempt.score / attempt.total_questions) * 100) : 0;
                  const dateStr = new Date(attempt.taken_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  
                  // Score circle content (7.5 for IELTS, 850 or ratio for TOEIC)
                  const isToeic = attempt.exams?.courses?.code?.toLowerCase() === 'toeic';
                  const scoreDisplay = isToeic ? `${Math.round(accuracy * 9.9)}` : `${(accuracy / 10).toFixed(1)}`;

                  return (
                    <div key={idx} className="flex items-center gap-4 border-b border-[#edeeef] pb-4 last:border-0 last:pb-0">
                      <div className="w-12 h-12 bg-[#d5e3ff] text-[#001b3c] rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 border border-blue-150">
                        {scoreDisplay}
                      </div>
                      <div className="flex-grow overflow-hidden">
                        <h4 className="font-bold text-xs text-[#001e40] truncate" title={attempt.exams?.title}>{attempt.exams?.title || "Bài thi online"}</h4>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Đúng {attempt.score}/{attempt.total_questions} • Ngày {dateStr}</p>
                      </div>
                      <span className="material-symbols-outlined text-[#5d5e5f] text-sm font-bold">chevron_right</span>
                    </div>
                  );
                })}

                {recentAttempts.length === 0 && (
                  <p className="text-xs text-[#5d5e5f] italic py-4 text-center">Bạn chưa thực hiện bài thi trực tuyến nào.</p>
                )}
              </div>
            </div>

            {/* Upcoming Calendar Reminders */}
            <div className="bg-white p-6 border border-[#c3c6d1] rounded-2xl shadow-sm space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-widest text-[#001e40]">Lịch học sắp tới</h3>
              
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="flex flex-col items-center justify-center bg-[#f3f4f5] px-3 py-2 rounded-xl border border-[#c3c6d1] shrink-0 min-w-[50px] leading-tight">
                    <span className="text-[9px] font-extrabold text-[#5d5e5f] uppercase tracking-wider">OCT</span>
                    <span className="text-lg font-extrabold text-[#001e40]">24</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#191c1d]">IELTS Mock Speaking</h4>
                    <p className="text-[10px] text-[#5d5e5f] font-semibold mt-0.5">14:00 • Zoom Room 3</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="flex flex-col items-center justify-center bg-[#f3f4f5] px-3 py-2 rounded-xl border border-[#c3c6d1] shrink-0 min-w-[50px] leading-tight">
                    <span className="text-[9px] font-extrabold text-[#5d5e5f] uppercase tracking-wider">OCT</span>
                    <span className="text-lg font-extrabold text-[#001e40]">28</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#191c1d]">TOEIC Mid-term Exam</h4>
                    <p className="text-[10px] text-[#5d5e5f] font-semibold mt-0.5">08:30 • Hall A</p>
                  </div>
                </div>
              </div>

              <button className="w-full mt-4 py-2 border border-[#001e40] text-[#001e40] font-bold rounded-xl text-xs hover:bg-[#d5e3ff] transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm">
                <span>Thêm nhắc nhở</span>
              </button>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
};

export default StudentDashboard;
