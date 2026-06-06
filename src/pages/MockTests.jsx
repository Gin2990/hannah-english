import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

const MockTests = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState('toeic'); // 'toeic' hoặc 'ielts'
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Premium full test book cover illustrations
  const testCovers = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCmodHSz_w_52YGQcxb3q5MnQ2ORecf76QwMqQfXQ-06nDArfeyjtM80SCJqm1YopjfPAya6jot9OqXZFMlLowltmjk-7L1vtA-lJ6daggQ62QXPZpA1q_z1Qf0N1yexU74i-20BzrEWgRuzJJOqSHQT0YnsS8O1pIC5ijeQpRbO182Kj3q-icFpbTlUdpwD8-3Co1FSzHG3NAN-S5phl6hYeEWOTfUJ4pVBb2hbzeBotg2hhgDhucWxoY_ZEoZpxXCnR6xjvaRHJ1t",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDSbVvpRum7q38yWWzIvRzdrPQysTYEIqhsJPkSJ-YQ_aBV2wn2LzR91x57071ZiNsWWyrwDNGpjuLt4aRqgZ_zfR4ONKDGP1psuS6dQ--ejLHDPedpnlqp9j6_ulWJG6qb6giNOmsyaWscOGQjRzFaJ1p4uXfKzKIAiSL_3Uw9ResXbf5c4wXjWZNO678sU5SgXzQlAnatF5fznKdg1EAJfm_XSsvjVgb88Jz_9_oB5jdW6jvCXx4WjQZJZEvZ_0o72c7B2yNYa-41",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDrvlYHOY3T6bUUcQ2yiqHCAF69r3rVxCQVf1jwJvpIK_TvUbHT2nAjxgDTpnyDn9tTM9Eof6dqwmI91xuthDukcoy4ZqzTsWLUbVVGljuMArgzMD4dPEqloFB29IyuZkNoR5SXM74Wa-pCy8qb356PCZGDkssltz3LXAHUEVS3MkGhPfqB02YEzCaALhjv47TDa8jZpIFuzuWppjxcPxQZ-9zPn_LtAPPt01q9CKY2xQiTv3NKf4_BvQ2CtoyB7JvsBMeVCdq7f27x"
  ];

  useEffect(() => {
    loadMockTests();
  }, [activeCourse]);

  const loadMockTests = async () => {
    if (!user) {
      setTests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: course, error: cError } = await supabase
        .from('courses')
        .select('id')
        .eq('code', activeCourse)
        .single();

      if (cError) throw cError;

      // Lấy class_id của học viên từ profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('class_id')
        .eq('id', user.id)
        .single();

      // Lấy danh sách đề thi thử (assignments) đã giao
      let query = supabase
        .from('assignments')
        .select(`
          due_date,
          exams (
            id,
            title,
            type,
            duration,
            question_count,
            course_id,
            test_parts
          )
        `);

      if (profile?.class_id) {
        query = query.or(`student_id.eq.${user.id},class_id.eq.${profile.class_id}`);
      } else {
        query = query.eq('student_id', user.id);
      }

      const { data: assignmentsData, error } = await query;
      if (error) throw error;

      // Trích xuất các đề thi thuộc loại test (thi thử) và thuộc khóa học hiện tại
      const examsList = assignmentsData
        ?.map(ass => {
          if (!ass.exams) return null;
          return {
            ...ass.exams,
            due_date: ass.due_date
          };
        })
        .filter(ex => ex && ex.course_id === course.id && ex.type === 'test')
        || [];

      // Loại bỏ trùng lặp nếu trùng id đề thi
      const uniqueTests = Array.from(new Map(examsList.map(item => [item.id, item])).values());
      setTests(uniqueTests);
    } catch (err) {
      console.error("Lỗi lấy danh sách đề thi thử:", err);
      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (testId) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (window.confirm("🔔 Bạn đã sẵn sàng bước vào phòng thi thử?\nĐồng hồ đếm ngược nghiêm ngặt sẽ kích hoạt ngay khi bạn nhấn Bắt đầu.")) {
      navigate(`/exam-taker/${testId}`);
    }
  };

  const getFilteredTests = () => {
    return tests.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] min-h-[calc(100vh-64px)] flex flex-col font-sans">
      <main className="max-w-[1440px] mx-auto w-full px-6 py-10 flex-grow space-y-8 animate-fade-in">
        
        {/* Banner Section */}
        <section className="bg-gradient-to-r from-[#001e40] to-[#6d0017] text-white p-8 rounded-3xl shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-3 z-10">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider text-rose-200">
              Exam Simulation
            </span>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">Cổng Thi Thử Full Test Online</h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
              Trải nghiệm phòng thi trực tuyến chuẩn 100% thời gian thực. Hệ thống chấm điểm tự động tích tắc và lưu kết quả chi tiết giúp đánh giá band điểm chính xác.
            </p>
          </div>
          
          {/* Tabs */}
          <div className="bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 z-10 flex">
            <button 
              onClick={() => setActiveCourse('toeic')}
              className={`px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeCourse === 'toeic' ? 'bg-white text-[#001e40] shadow-sm' : 'text-white hover:bg-white/5'}`}
            >
              TOEIC Full Test
            </button>
            <button 
              onClick={() => setActiveCourse('ielts')}
              className={`px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeCourse === 'ielts' ? 'bg-white text-[#001e40] shadow-sm' : 'text-white hover:bg-white/5'}`}
            >
              IELTS Full Test
            </button>
          </div>
        </section>

        {/* Filter sticky bar */}
        <section className="bg-white p-4 rounded-2xl border border-[#c3c6d1] shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs font-bold text-[#5d5e5f]">
            Danh sách <span className="text-[#001e40] font-extrabold">{getFilteredTests().length}</span> đề thi thử đang mở khóa 🔒/🔓
          </div>

          <div className="relative w-full sm:w-60">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên đề thi..."
              className="pl-9 pr-4 py-1.5 w-full bg-[#f3f4f5] border border-[#c3c6d1] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#001e40]"
            />
          </div>
        </section>

        {/* Card list */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#001e40] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400">Đang đồng bộ cổng thi thử...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredTests().map((test, index) => {
              const coverImg = testCovers[index % testCovers.length];
              return (
                <div 
                  key={test.id}
                  className="bg-white border border-[#c3c6d1] rounded-2xl overflow-hidden hover:border-[#001e40] hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="aspect-video relative overflow-hidden border-b border-slate-100">
                    <img className="w-full h-full object-cover" src={coverImg} alt="Cover" />
                    <span className="absolute top-3 left-3 px-2 py-0.5 bg-[#6d0017] text-white rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-sm">
                      {activeCourse.toUpperCase()} Full Test
                    </span>
                  </div>

                  <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-display font-extrabold text-sm text-[#001e40] line-clamp-2" title={test.title}>
                        {test.title}
                      </h3>
                      
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[#5d5e5f] font-bold">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">schedule</span> {test.duration} phút</span>
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">quiz</span> {test.question_count} câu hỏi</span>
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">layers</span> {test.test_parts?.length || 1} phần đề</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartExam(test.id)}
                      className="w-full py-2.5 border border-[#001e40] text-[#001e40] hover:bg-[#001e40] hover:text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-97 shadow-sm"
                    >
                      <span>Vào thi thử ngay</span>
                      <span className="material-symbols-outlined text-sm font-bold">play_arrow</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {getFilteredTests().length === 0 && (
              <div className="col-span-full text-center py-20 bg-white border border-[#c3c6d1] rounded-2xl text-slate-400 text-xs">
                <span className="material-symbols-outlined text-3xl block mb-2">sentiment_dissatisfied</span>
                Chưa có đề thi thử nào được xuất bản.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default MockTests;
