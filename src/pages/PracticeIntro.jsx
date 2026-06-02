import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

const PracticeIntro = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState('unlimited'); // 'unlimited' hoặc số phút
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (id && user) {
      loadExerciseDetails();
    }
  }, [id, user]);

  const loadExerciseDetails = async () => {
    try {
      setLoading(true);
      
      // 1. Lấy thông tin chi tiết bài tập
      const { data: exData, error: exError } = await supabase
        .from('exams')
        .select(`
          *,
          courses (
            id,
            code,
            title
          )
        `)
        .eq('id', id)
        .single();

      if (exError) throw exError;
      setExercise(exData);

      // 2. Kiểm tra phân quyền học viên cho khóa học này
      const { data: permission, error: pError } = await supabase
        .from('student_courses')
        .select('*')
        .eq('student_id', user.id)
        .eq('course_id', exData.courses.id);

      if (pError) throw pError;
      
      const allowed = permission.length > 0 || user.role === 'admin' || user.role === 'teacher';
      setHasPermission(allowed);
    } catch (err) {
      console.error("Lỗi lấy thông tin chi tiết bài tập:", err);
      alert("Không thể tải thông tin bài tập này!");
      navigate('/practice');
    } finally {
      setLoading(false);
    }
  };

  const getPartLabel = (partCode) => {
    if (!partCode) return "Luyện tập chung";
    const labels = {
      // TOEIC Parts
      'toeic_part1': 'Part 1: Photos (Tranh mô tả)',
      'toeic_part2': 'Part 2: Question-Response (Hỏi đáp)',
      'toeic_part3': 'Part 3: Conversations (Hội thoại)',
      'toeic_part4': 'Part 4: Talks (Bài nói ngắn)',
      'toeic_part5': 'Part 5: Incomplete Sentences (Điền vào câu)',
      'toeic_part6': 'Part 6: Text Completion (Điền đoạn văn)',
      'toeic_part7': 'Part 7: Reading Comprehension (Đọc hiểu)',
      // IELTS Parts
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

  const handleStart = () => {
    if (!hasPermission) {
      alert(`🔒 Bài tập này thuộc khóa học ${exercise?.courses?.title || ''} chưa được phân quyền cho bạn!\nVui lòng liên hệ Giáo viên hoặc Quản trị viên để được mở khóa.`);
      return;
    }

    // Điều hướng sang ExamTaker kèm tham số thời gian làm bài đã chọn
    navigate(`/exam-taker/${exercise.id}?timeLimit=${selectedDuration}`);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-[#f8f9fa] gap-3">
        <div className="w-10 h-10 border-4 border-[#001e40] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Đang nạp cấu hình bài tập...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] min-h-[calc(100vh-64px)] py-12 px-6">
      <div className="max-w-[720px] mx-auto bg-white border border-[#c3c6d1] rounded-3xl p-8 shadow-md space-y-6">
        
        {/* Title Header */}
        <div className="space-y-2 border-b border-slate-100 pb-4">
          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[9px] font-extrabold uppercase tracking-wide">
            Bài tập ôn luyện (Practice Mode)
          </span>
          <h1 className="font-display font-extrabold text-[#001e40] text-xl sm:text-2xl leading-snug">
            {exercise?.title}
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            Khóa học: {exercise?.courses?.title} • {exercise?.question_count} câu hỏi
          </p>
        </div>

        {/* Pro Tips Box matching mockup */}
        <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex gap-3 text-emerald-800 text-xs leading-relaxed font-medium">
          <span className="material-symbols-outlined text-lg shrink-0 text-emerald-650 font-bold">tips_and_updates</span>
          <div>
            <strong className="text-emerald-900 block mb-0.5">Pro tips:</strong>
            Hình thức luyện tập từng phần và chọn mức thời gian phù hợp sẽ giúp bạn tập trung vào giải đúng các câu hỏi thay vì phải chịu áp lực hoàn thành bài thi.
          </div>
        </div>

        {/* Part Description / Sections */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-extrabold text-[#001e40] uppercase tracking-wider">Phần bài tập sẽ làm</h3>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#001e40] text-xl font-bold bg-white p-2 rounded-xl border border-slate-200">
                {exercise?.listening_audio_url ? 'headphones' : 'menu_book'}
              </span>
              <div>
                <p className="font-bold text-xs text-[#001e40]">
                  {getPartLabel(exercise?.part_code)}
                </p>
                <span className="text-[10px] text-slate-400 font-bold">{exercise?.question_count} câu hỏi trắc nghiệm</span>
              </div>
            </div>
            {exercise?.listening_audio_url && (
              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[9px] font-extrabold">Có file nghe</span>
            )}
          </div>
        </div>

        {/* Custom Duration Selector matching mockup */}
        <div className="space-y-2">
          <h3 className="text-xs font-extrabold text-[#001e40] uppercase tracking-wider">Giới hạn thời gian</h3>
          <p className="text-[10px] text-slate-450 font-semibold mb-2">Để trống (Không giới hạn) nếu muốn làm bài tập luyện tự do.</p>
          
          <select 
            value={selectedDuration}
            onChange={(e) => setSelectedDuration(e.target.value)}
            className="w-full text-xs font-bold text-[#001e40] border border-[#c3c6d1] rounded-2xl py-3 px-4 focus:outline-none focus:border-[#001e40] bg-white cursor-pointer"
          >
            <option value="unlimited">-- Làm tự do (Không giới hạn thời gian) --</option>
            {exercise?.allowed_durations && exercise.allowed_durations.map(dur => (
              <option key={dur} value={dur}>{dur} phút</option>
            ))}
          </select>
        </div>

        {/* Big Start button */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button 
            onClick={() => navigate('/practice')}
            className="w-full sm:w-auto px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-wide transition-all text-center"
          >
            Quay lại
          </button>
          
          <button 
            onClick={handleStart}
            className="w-full sm:w-auto px-10 py-3 bg-[#001e40] hover:bg-[#003366] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-97 flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm font-bold">menu_book</span>
            <span>LUYỆN TẬP</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default PracticeIntro;
