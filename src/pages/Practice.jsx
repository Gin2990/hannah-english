import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

const Practice = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState('toeic'); // 'toeic' hoặc 'ielts'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState('all');
  const navigate = useNavigate();

  // Mảng sách bìa tượng trưng cực kỳ đẹp mắt
  const practiceCovers = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCmQBFL6siBlWyiHlCsNoi44FJiu2PXkPI8pZ10X37P-a6HZDWlkJ-ndyt8jOO2lEMBJhK71EHMgbqN7qXdOy2oTIWW8sCHWW07tdRtBG6FKrPIW8oj7yUt-fvqkvOVP8eJnF_LcnfB28RWcd-TzxRKIeRgNpLPQvt5kUIW0Oe_Rhwsa4dpyHv2g1SyVWjC42leoj6R01NN-02o7grsR9hPM2LDny0lcQrlHRQItaLITy1fZKjDlXwSsM3k7IK3rNnXuMvDNIfq_Uqp",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDR_c1E-kGtblCPrBk6gC89Yx_u183TtxNooU_fe-eOpTAWqovwyQ3sHb55ocP3-m0Zoljg2B1TFK16i8ITjle14xlIvrZ6LuURdwQq3gyzZDGNJ1z3RKwqgBQCfbI5o28H9S0tpeqOPG4vG1y2r1hKMcgltGaIuywd2WNwE1__hF4hs8ob3RO_iwZ1-EH_IwdA6-Ffh8CKWsWymtKjXDdhCoFDP9K9muSECdrVxqXo8hY8ig96bPP6q41agw9bZJ9h1bOMWau89VPC",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCmQBFL6siBlWyiHlCsNoi44FJiu2PXkPI8pZ10X37P-a6HZDWlkJ-ndyt8jOO2lEMBJhK71EHMgbqN7qXdOy2oTIWW8sCHWW07tdRtBG6FKrPIW8oj7yUt-fvqkvOVP8eJnF_LcnfB28RWcd-TzxRKIeRgNpLPQvt5kUIW0Oe_Rhwsa4dpyHv2g1SyVWjC42leoj6R01NN-02o7grsR9hPM2LDny0lcQrlHRQItaLITy1fZKjDlXwSsM3k7IK3rNnXuMvDNIfq_Uqp"
  ];

  useEffect(() => {
    loadPracticeExercises();
  }, [activeCourse]);

  const loadPracticeExercises = async () => {
    try {
      setLoading(true);
      // Lấy thông tin ID khóa học trước
      const { data: course, error: cError } = await supabase
        .from('courses')
        .select('id')
        .eq('code', activeCourse)
        .single();

      if (cError) throw cError;

      // Lấy toàn bộ bài tập (homework) của khóa học đó
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('course_id', course.id)
        .eq('type', 'homework')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExercises(data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách bài tập:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPractice = (exerciseId) => {
    if (!user) {
      navigate('/auth');
    } else {
      navigate(`/practice-intro/${exerciseId}`);
    }
  };

  const getPartLabel = (partCode) => {
    if (!partCode) return "Luyện tập chung";
    const labels = {
      // Simplified Skill Codes
      'toeic_listening': 'Kỹ năng Nghe (Full Part 1-4)',
      'toeic_reading': 'Kỹ năng Đọc (Full Part 5-7)',
      'ielts_listening': 'Kỹ năng Nghe (Full Section 1-4)',
      'ielts_reading': 'Kỹ năng Đọc (Full Passage 1-3)',
      // Legacy Specific Parts
      'toeic_part1': 'Part 1: Photos (Tranh mô tả)',
      'toeic_part2': 'Part 2: Question-Response (Hỏi đáp)',
      'toeic_part3': 'Part 3: Conversations (Hội thoại)',
      'toeic_part4': 'Part 4: Talks (Bài nói ngắn)',
      'toeic_part5': 'Part 5: Incomplete Sentences (Điền vào câu)',
      'toeic_part6': 'Part 6: Text Completion (Điền đoạn văn)',
      'toeic_part7': 'Part 7: Reading Comprehension (Đọc hiểu)',
      'ielts_listening_part1': 'Listening Part 1 (Hội thoại đời sống)',
      'ielts_listening_part2': 'Listening Part 2 (Độc thoại đời sống)',
      'ielts_listening_part3': 'Listening Part 3 (Hội thoại học thuật)',
      'ielts_listening_part4': 'Listening Part 4 (Độc thoại học thuật)',
      'ielts_reading_passage1': 'Reading Passage 1 (Đoạn văn 1)',
      'ielts_reading_passage2': 'Reading Passage 2 (Đoạn văn 2)',
      'ielts_reading_passage3': 'Reading Passage 3 (Đoạn văn 3)'
    };
    return labels[partCode] || partCode;
  };

  const getFilteredExercises = () => {
    return exercises.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPart = selectedPart === 'all' || e.part_code === selectedPart;
      return matchesSearch && matchesPart;
    });
  };

  // Danh mục Part lọc động rút gọn theo yêu cầu
  const partsFilter = activeCourse === 'toeic' ? [
    { code: 'toeic_listening', name: 'Kỹ năng Nghe (Parts 1-4)' },
    { code: 'toeic_reading', name: 'Kỹ năng Đọc (Parts 5-7)' }
  ] : [
    { code: 'ielts_listening', name: 'Kỹ năng Nghe (Sections 1-4)' },
    { code: 'ielts_reading', name: 'Kỹ năng Đọc (Passages 1-3)' }
  ];

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] min-h-[calc(100vh-64px)] flex flex-col font-sans">
      <main className="max-w-[1440px] mx-auto w-full px-6 py-10 flex-grow space-y-8 animate-fade-in">
        
        {/* Banner Section */}
        <section className="bg-gradient-to-r from-[#001e40] to-[#003366] text-white p-8 rounded-3xl shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-3 z-10">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider text-blue-200">
              Practice Hub
            </span>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">Thư Viện Ôn Luyện Kỹ Năng</h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
              Hệ thống các bài tập ngắn chia nhỏ theo từng phần đề thi chuẩn quốc tế giúp bạn tập trung nâng cao phản xạ và cải thiện lỗ hổng kiến thức nhanh chóng.
            </p>
          </div>
          
          {/* Course Selector Tabs */}
          <div className="bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 z-10 flex">
            <button 
              onClick={() => { setActiveCourse('toeic'); setSelectedPart('all'); }}
              className={`px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeCourse === 'toeic' ? 'bg-white text-[#001e40] shadow-sm' : 'text-white hover:bg-white/5'}`}
            >
              TOEIC Practice
            </button>
            <button 
              onClick={() => { setActiveCourse('ielts'); setSelectedPart('all'); }}
              className={`px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeCourse === 'ielts' ? 'bg-white text-[#001e40] shadow-sm' : 'text-white hover:bg-white/5'}`}
            >
              IELTS Practice
            </button>
          </div>
        </section>

        {/* Filter sticky bar */}
        <section className="bg-white p-4 rounded-2xl border border-[#c3c6d1] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
            <button 
              onClick={() => setSelectedPart('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${selectedPart === 'all' ? 'bg-[#001e40] text-white border-[#001e40]' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
            >
              Tất cả Parts
            </button>
            {partsFilter.map(p => (
              <button 
                key={p.code}
                onClick={() => setSelectedPart(p.code)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${selectedPart === p.code ? 'bg-[#001e40] text-white border-[#001e40]' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-60">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên bài tập..."
              className="pl-9 pr-4 py-1.5 w-full bg-[#f3f4f5] border border-[#c3c6d1] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#001e40]"
            />
          </div>
        </section>

        {/* Grid Lists */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#001e40] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400">Đang chuẩn bị kho bài tập...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredExercises().map((ex, index) => {
              const coverImg = practiceCovers[index % practiceCovers.length];
              return (
                <div 
                  key={ex.id}
                  className="bg-white border border-[#c3c6d1] rounded-2xl overflow-hidden hover:border-[#001e40] hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="aspect-video relative overflow-hidden border-b border-slate-100 bg-slate-55">
                    <img className="w-full h-full object-cover" src={coverImg} alt="Cover" />
                    <span className="absolute top-3 left-3 px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[9px] font-extrabold uppercase tracking-wide">
                      {activeCourse.toUpperCase()} Practice
                    </span>
                  </div>
                  
                  <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <h3 className="font-display font-extrabold text-sm text-[#001e40] line-clamp-2" title={ex.title}>
                        {ex.title}
                      </h3>
                      <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-0.5 font-bold inline-block leading-none">
                        {getPartLabel(ex.part_code)}
                      </p>
                      
                      <div className="flex items-center gap-4 text-[10px] text-[#5d5e5f] font-bold pt-1.5">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">quiz</span> {ex.question_count} câu hỏi</span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">headphones</span> 
                          {ex.listening_audio_url ? "Có file nghe" : "Đọc hiểu"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartPractice(ex.id)}
                      className="w-full py-2.5 border border-emerald-600 text-emerald-650 hover:bg-emerald-600 hover:text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-97 shadow-sm"
                    >
                      <span>Luyện tập ngay</span>
                      <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {getFilteredExercises().length === 0 && (
              <div className="col-span-full text-center py-20 bg-white border border-[#c3c6d1] rounded-2xl text-slate-400 text-xs">
                <span className="material-symbols-outlined text-3xl block mb-2">sentiment_dissatisfied</span>
                Chưa có bài tập nào thuộc danh mục này được tải lên.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Practice;
