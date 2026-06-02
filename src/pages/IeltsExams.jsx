import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

const IeltsExams = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const navigate = useNavigate();

  // Premium academic IELTS cover designs
  const bookCovers = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCbhc1EkjGtblCPrBk6gC89Yx_u183TtxNooU_fe-eOpTAWqovwyQ3sHb55ocP3-m0Zoljg2B1TFK16i8ITjle14xlIvrZ6LuURdwQq3gyzZDGNJ1z3RKwqgBQCfbI5o28H9S0tpeqOPG4vG1y2r1hKMcgltGaIuywd2WNwE1__hF4hs8ob3RO_iwZ1-EH_IwdA6-Ffh8CKWsWymtKjXDdhCoFDP9K9muSECdrVxqXo8hY8ig96bPP6q41agw9bZJ9h1bOMWau89VPC",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCmodHSz_w_52YGQcxb3q5MnQ2ORecf76QwMqQfXQ-06nDArfeyjtM80SCJqm1YopjfPAya6jot9OqXZFMlLowltmjk-7L1vtA-lJ6daggQ62QXPZpA1q_z1Qf0N1yexU74i-20BzrEWgRuzJJOqSHQT0YnsS8O1pIC5ijeQpRbO182Kj3q-icFpbTlUdpwD8-3Co1FSzHG3NAN-S5phl6hYeEWOTfUJ4pVBb2hbzeBotg2hhgDhucWxoY_ZEoZpxXCnR6xjvaRHJ1t",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDSbVvpRum7q38yWWzIvRzdrPQysTYEIqhsJPkSJ-YQ_aBV2wn2LzR91x57071ZiNsWWyrwDNGpjuLt4aRqgZ_zfR4ONKDGP1psuS6dQ--ejLHDPedpnlqp9j6_ulWJG6qb6giNOmsyaWscOGQjRzFaJ1p4uXfKzKIAiSL_3Uw9ResXbf5c4wXjWZNO678sU5SgXzQlAnatF5fznKdg1EAJfm_XSsvjVgb88Jz_9_oB5jdW6jvCXx4WjQZJZEvZ_0o72c7B2yNYa-41"
  ];

  useEffect(() => {
    if (user) {
      checkPermissionAndLoadExams();
    }
  }, [user]);

  const checkPermissionAndLoadExams = async () => {
    try {
      setLoading(true);
      
      // 1. Check IELTS course permission
      const { data: permissions, error: pError } = await supabase
        .from('student_courses')
        .select(`
          courses (
            code
          )
        `)
        .eq('student_id', user.id);

      if (pError) throw pError;

      const hasIelts = permissions.some(item => item.courses?.code === 'ielts');
      if (!hasIelts) {
        alert("🔒 Bạn chưa được phân quyền truy cập các đề thi khóa học IELTS!");
        navigate('/student');
        return;
      }

      // 2. Get IELTS Course ID
      const { data: course, error: cError } = await supabase
        .from('courses')
        .select('id')
        .eq('code', 'ielts')
        .single();

      if (cError) throw cError;

      // 3. Load exams for IELTS
      const { data: examsList, error: eError } = await supabase
        .from('exams')
        .select('*')
        .eq('course_id', course.id)
        .order('created_at', { ascending: false });

      if (eError) throw eError;

      setExams(examsList || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách đề thi IELTS:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (examId) => {
    if (window.confirm("🔔 Bạn đã sẵn sàng làm bài thi này chưa?\nĐồng hồ đếm ngược sẽ bắt đầu chạy ngay khi bạn vào phòng thi.")) {
      navigate(`/exam-taker/${examId}`);
    }
  };

  // Filter exams by query and difficulty
  const filteredExams = exams.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Custom logic to simulate difficulty filter
    if (difficultyFilter === 'easy') {
      return matchesSearch && e.duration <= 15;
    } else if (difficultyFilter === 'medium') {
      return matchesSearch && e.duration > 15 && e.duration <= 45;
    } else if (difficultyFilter === 'hard') {
      return matchesSearch && e.duration > 45;
    }
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-[#f8f9fa] gap-3">
        <div className="w-10 h-10 border-4 border-[#001e40] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-400">Đang kết nối thư viện đề thi IELTS online...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] min-h-[calc(100vh-64px)] flex flex-col font-sans">
      <main className="max-w-[1440px] mx-auto w-full px-6 py-10 flex-grow space-y-8 animate-fade-in">
        
        {/* Hero Section */}
        <section className="mb-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-3">
              <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-750 border border-indigo-200 rounded-full text-xs font-bold uppercase tracking-wider">
                IELTS Academic & General
              </span>
              <h1 className="font-display font-extrabold text-3xl text-[#001e40] tracking-tight">
                Thư viện IELTS Masterclass
              </h1>
              <p className="text-slate-500 text-sm max-w-2xl leading-relaxed">
                Tổng hợp các bộ đề thi IELTS thử nghiệm chất lượng cao bám sát cấu trúc đề thi chính thức của IDP và British Council. Chấm điểm trực tuyến và thống kê kết quả tức thì.
              </p>
            </div>
          </div>
        </section>

        {/* Filter & Search sticky bar */}
        <section className="bg-white p-4 rounded-xl border border-[#c3c6d1] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-16 z-30">
          <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm đề thi..."
                className="pl-9 pr-4 py-1.5 w-full bg-[#f3f4f5] border border-[#c3c6d1] rounded-xl focus:outline-none focus:border-[#001e40] text-xs font-semibold"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[#5d5e5f]">Cấp độ:</span>
              <select 
                value={difficultyFilter} 
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="border border-[#c3c6d1] rounded-xl px-2.5 py-1 text-xs focus:ring-1 focus:ring-primary bg-white cursor-pointer font-bold text-[#001e40]"
              >
                <option value="all">Tất cả mức độ</option>
                <option value="easy">Dễ (5.0 - 6.0)</option>
                <option value="medium">Trung bình (6.5 - 7.0)</option>
                <option value="hard">Khó (7.5+)</option>
              </select>
            </div>
          </div>

          <div className="text-[#5d5e5f] font-bold text-xs">
            Hiển thị <span className="text-[#001e40] font-extrabold">{filteredExams.length}</span> trong số {exams.length} đề thi
          </div>
        </section>

        {/* IELTS Exam Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam, index) => {
            const coverUrl = bookCovers[index % bookCovers.length];

            return (
              <div 
                key={exam.id}
                className="group relative bg-white border border-[#c3c6d1] rounded-2xl overflow-hidden hover:border-[#001e40] hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div className="aspect-video relative overflow-hidden shrink-0 border-b border-[#c3c6d1]">
                  <img 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    src={coverUrl} 
                    alt="Book Cover Illustration" 
                  />
                </div>

                <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-display font-extrabold text-[#001e40] text-sm group-hover:text-[#003366] transition-colors leading-snug line-clamp-2">
                      {exam.title}
                    </h3>
                    
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[#5d5e5f] font-bold pt-1 items-center">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">schedule</span> {exam.duration} phút</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">quiz</span> {exam.question_count} câu hỏi</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${exam.type === 'homework' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-[#d5e3ff] text-[#001b3c] border-blue-100'}`}>
                        {exam.type === 'homework' ? 'Luyện tập' : 'Thi thử'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="h-1 w-full bg-[#f3f4f5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#001e40] rounded-full transition-all" style={{ width: "25%" }}></div>
                    </div>
                    
                    <button 
                      onClick={() => handleStartExam(exam.id)}
                      className={`w-full py-2.5 border font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-97 shadow-sm ${exam.type === 'homework' ? 'border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white' : 'border-[#001e40] text-[#001e40] hover:bg-[#001e40] hover:text-white'}`}
                    >
                      <span>{exam.type === 'homework' ? 'Làm bài tập' : 'Vào thi ngay'}</span>
                      <span className="material-symbols-outlined text-sm font-bold">
                        {exam.type === 'homework' ? 'menu_book' : 'play_arrow'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredExams.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white border border-[#c3c6d1] rounded-2xl text-[#5d5e5f] text-xs">
              <span className="material-symbols-outlined text-3xl block mb-2 font-bold">sentiment_dissatisfied</span>
              Không tìm thấy đề thi IELTS nào phù hợp.
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default IeltsExams;
