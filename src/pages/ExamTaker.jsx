import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

// CÁC HÀM XỬ LÝ ĐỔI LINK GOOGLE DRIVE THÀNH LINK DIRECT MEDIA TRỰC TIẾP
const convertGoogleDriveAudioLink = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  
  // Khớp link dạng: /file/d/FILE_ID/
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) {
    return `https://docs.google.com/uc?export=download&id=${fileDMatch[1]}`;
  }
  
  // Khớp link dạng: ?id=FILE_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com'))) {
    return `https://docs.google.com/uc?export=download&id=${idMatch[1]}`;
  }
  
  return trimmed;
};

const convertGoogleDrivePdfLink = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  
  // Khớp link dạng: /file/d/FILE_ID/
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) {
    return `https://drive.google.com/file/d/${fileDMatch[1]}/preview`;
  }
  
  // Khớp link dạng: ?id=FILE_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com'))) {
    return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }
  
  return trimmed;
};

const parseQuestionInstruction = (q) => {
  if (!q) return { instruction: "", questionText: "" };
  if (q.instruction) {
    return { instruction: q.instruction, questionText: q.question };
  }
  const match = q.question?.match(/^\[\s*([\s\S]+?)\s*\]\s*\n([\s\S]*)$/);
  if (match) {
    return { instruction: match[1].trim(), questionText: match[2].trim() };
  }
  return { instruction: "", questionText: q.question || "" };
};

const matchIeltsAnswer = (studentAns, databaseAns) => {
  if (!databaseAns) return false;
  const selected = studentAns ? studentAns.trim().toLowerCase() : '';
  const correctAns = databaseAns.trim().toLowerCase();
  
  if (!selected) return false;

  const expandIeltsAnswer = (ans) => {
    const results = new Set();
    const clean = ans.trim().toLowerCase();
    results.add(clean);
    
    const normalized = clean.replace(/\s+/g, ' ');
    results.add(normalized);
    
    // Remove parentheses but keep content inside: e.g. "10(th)" -> "10th"
    const keepContent = normalized.replace(/\(([^)]+)\)/g, '$1');
    results.add(keepContent);
    results.add(keepContent.replace(/\s+/g, ' '));
    
    // Remove parentheses and their content entirely: e.g. "10(th)" -> "10"
    const removeContent = normalized.replace(/\([^)]*\)/g, '');
    results.add(removeContent.trim());
    results.add(removeContent.replace(/\s+/g, ' ').trim());
    
    return Array.from(results);
  };

  // 1. Check direct match of full string
  const fullExpansions = expandIeltsAnswer(correctAns);
  if (fullExpansions.includes(selected)) return true;

  // 2. Split by slash and check each option
  const alternatives = correctAns.split('/').map(a => a.trim());
  for (const alt of alternatives) {
    const expansions = expandIeltsAnswer(alt);
    if (expansions.includes(selected)) return true;
  }

  return false;
};

const ExamTaker = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [scoreData, setScoreData] = useState({ score: 0, total: 0, accuracy: 0, timeTaken: 0 });

  // Bộ đếm thời gian
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [useCountdown, setUseCountdown] = useState(true); // true: đếm ngược, false: đếm tiến (stopwatch)

  // Quản lý Tabs câu hỏi cho Đề thi thử (Full Test)
  const [activePartIdx, setActivePartIdx] = useState(0);

  const timerRef = useRef(null);

  useEffect(() => {
    if (id) {
      loadExamDetails();
    }
    return () => clearInterval(timerRef.current);
  }, [id]);

  useEffect(() => {
    if (exam && !isSubmitted) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);

        if (useCountdown) {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              alert("⏰ Đã hết thời gian làm bài! Hệ thống tự động nộp bài.");
              handleSubmit(false, true); // Tự động nộp
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [exam, isSubmitted, useCountdown]);

  const loadExamDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setExam(data);

      // Đọc cấu hình thời gian làm bài từ Trang Intro (chỉ áp dụng cho Bài Tập)
      const queryParams = new URLSearchParams(location.search);
      const timeLimitParam = queryParams.get('timeLimit'); // 'unlimited' hoặc số phút

      if (data.type === 'homework') {
        if (!timeLimitParam || timeLimitParam === 'unlimited') {
          // Luyện tập tự do -> Đếm tiến
          setUseCountdown(false);
          setTotalTime(0);
          setTimeRemaining(0);
        } else {
          // Luyện tập có chọn giới hạn thời gian -> Đếm ngược
          const selectedMinutes = parseInt(timeLimitParam);
          setUseCountdown(true);
          setTotalTime(selectedMinutes * 60);
          setTimeRemaining(selectedMinutes * 60);
        }
      } else {
        // Đề thi thử Full Test -> Bắt buộc Đếm ngược thời gian chuẩn của đề
        const defaultSeconds = data.duration * 60;
        setUseCountdown(true);
        setTotalTime(defaultSeconds);
        setTimeRemaining(defaultSeconds);
      }
    } catch (err) {
      console.error("Lỗi nạp phòng thi:", err);
      alert("Không thể tải phòng thi này!");
      navigate('/practice');
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (qId, optionLetter) => {
    if (isSubmitted) return;
    setStudentAnswers(prev => ({
      ...prev,
      [qId]: optionLetter
    }));
  };

  const checkQuestionCorrect = (q) => {
    if (!q) return false;
    return matchIeltsAnswer(studentAnswers[q.id], q.correct);
  };

  const getButtonColorClass = (q, isActive) => {
    if (isSubmitted) {
      const isCorrect = checkQuestionCorrect(q);
      return isCorrect 
        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm font-extrabold' 
        : 'bg-red-500 border-red-500 text-white shadow-sm font-extrabold';
    }
    const isAnswered = !!studentAnswers[q.id];
    return isAnswered 
      ? 'bg-[#001e40] border-[#001e40] text-white shadow-sm font-extrabold' 
      : isActive 
        ? 'border-[#001e40] text-[#001e40] bg-indigo-50/50 font-extrabold' 
        : 'border-slate-200 text-slate-440 hover:border-[#001e40] hover:text-[#001e40]';
  };


  // Click bản đồ câu hỏi tự nhảy Tab Part tương ứng của câu đó và cuộn tới câu hỏi
  const handleMapClick = (partIndex, qId) => {
    setActivePartIdx(partIndex);
    setTimeout(() => {
      const el = document.getElementById(`q-card-${qId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('border-primary', 'shadow-md');
        setTimeout(() => el.classList.remove('border-primary', 'shadow-md'), 1500);
      }
    }, 100);
  };

  // NỘP BÀI THI & CHẤM ĐIỂM ĐA LUỒNG
  const handleSubmit = async (confirmRequired = true, forceSubmit = false) => {
    if (isSubmitted) return;

    // Tính toán tổng số câu hỏi dựa trên cấu trúc đề
    let allQuestionsList = [];
    if (exam.test_parts && exam.test_parts.length > 0) {
      exam.test_parts.forEach(p => {
        if (p.questions) allQuestionsList = [...allQuestionsList, ...p.questions];
      });
    } else {
      allQuestionsList = exam.questions || [];
    }

    const totalCount = allQuestionsList.length;
    const answeredCount = Object.keys(studentAnswers).length;

    if (confirmRequired && !forceSubmit) {
      if (answeredCount < totalCount) {
        if (!window.confirm(`⚠️ Bạn mới làm được ${answeredCount}/${totalCount} câu. Bạn có chắc chắn muốn nộp bài sớm không?`)) {
          return;
        }
      } else {
        if (!window.confirm("Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?")) {
          return;
        }
      }
    }

    setIsSubmitted(true);
    clearInterval(timerRef.current);

    // Chấm điểm trắc nghiệm & tự luận IELTS tự động
    let correctCount = 0;
    allQuestionsList.forEach((q) => {
      if (matchIeltsAnswer(studentAnswers[q.id], q.correct)) {
        correctCount++;
      }
    });

    const elapsedMinutes = Math.ceil(elapsedSeconds / 60) || 1;
    const accuracy = Math.round((correctCount / totalCount) * 100);

    setScoreData({
      score: correctCount,
      total: totalCount,
      accuracy: accuracy,
      timeTaken: elapsedMinutes
    });

    // Lưu trữ lên Supabase
    try {
      const { error } = await supabase
        .from('exam_results')
        .insert({
          student_id: user.id,
          exam_id: exam.id,
          score: correctCount,
          total_questions: totalCount,
          duration_seconds: elapsedSeconds,
          answers: studentAnswers
        });

      if (error) throw error;
      console.log("Đã lưu kết quả thi thử lên database!");
    } catch (err) {
      console.error("Lỗi đồng bộ lịch sử thi:", err);
    }

    setShowResult(true);
  };

  const formatTimer = () => {
    const time = useCountdown ? timeRemaining : elapsedSeconds;
    const m = Math.floor(time / 60);
    const s = time % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const confirmExit = () => {
    if (isSubmitted) {
      navigate(exam?.type === 'homework' ? '/practice' : '/mock-tests');
    } else {
      if (window.confirm("⚠️ Tiến trình làm bài sẽ BỊ HỦY BỎ và không được lưu lại nếu bạn thoát ra lúc này! Bạn có thực sự muốn thoát?")) {
        navigate(exam?.type === 'homework' ? '/practice' : '/mock-tests');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-[#001e40] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Đang thiết lập phòng thi trực tuyến...</p>
      </div>
    );
  }

  // Khởi tạo danh sách câu hỏi để làm bản đồ câu hỏi và giao diện hiển thị
  const isFullTest = exam?.test_parts && exam.test_parts.length > 0;
  const currentPart = isFullTest ? exam.test_parts[activePartIdx] : null;
  const currentQuestions = isFullTest ? (currentPart?.questions || []) : (exam?.questions || []);
  
  const hasPassageContent = isFullTest ? !!currentPart?.part_content : !!exam?.passage_text;
  const activeAudioUrl = isFullTest ? (currentPart?.audio_url || exam?.listening_audio_url) : exam?.listening_audio_url;
  const isListening = exam?.test_parts?.some(p => p.audio_url) || !!exam?.listening_audio_url;
  const showSplitScreen = exam && (exam.pdf_url || hasPassageContent);

  if (showSplitScreen) {
    return (
      <div className="h-screen w-full flex flex-col bg-[#f8f9fa] selection:bg-[#001e40] selection:text-white overflow-hidden">
        {/* Style block scoped for dynamic HTML formatting in the passage column */}
        <style dangerouslySetInnerHTML={{__html: `
          .passage-content {
            color: #334155;
            font-size: 0.875rem;
            line-height: 1.7;
          }
          .passage-content h3 {
            font-size: 1.125rem;
            font-weight: 800;
            color: #001e40;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 0.25rem;
          }
          .passage-content h4 {
            font-size: 1rem;
            font-weight: 700;
            color: #0f172a;
            margin-top: 1.25rem;
            margin-bottom: 0.5rem;
          }
          .passage-content p {
            margin-bottom: 1rem;
          }
          .passage-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
            font-size: 0.8rem;
          }
          .passage-content th, .passage-content td {
            border: 1px solid #c3c6d1;
            padding: 8px 12px;
            text-align: left;
            vertical-align: top;
          }
          .passage-content th {
            background-color: #f1f5f9;
            color: #001e40;
            font-weight: 700;
          }
          .passage-content tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .passage-content ul {
            list-style-type: disc;
            padding-left: 1.5rem;
            margin-bottom: 1rem;
          }
          .passage-content ol {
            list-style-type: decimal;
            padding-left: 1.5rem;
            margin-bottom: 1rem;
          }
          .passage-content li {
            margin-bottom: 0.25rem;
          }
          .passage-content strong {
            color: #0f172a;
            font-weight: 700;
          }
          .passage-content .highlight-box {
            background-color: #f8fafc;
            border-left: 4px solid #001e40;
            padding: 1rem;
            margin: 1.5rem 0;
            border-radius: 0 0.75rem 0.75rem 0;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}} />
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shrink-0">
          <div className="w-full px-6 h-16 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#001e40] text-2xl font-bold">
                {hasPassageContent ? 'menu_book' : 'picture_as_pdf'}
              </span>
              <div>
                <h1 className="font-extrabold text-sm text-[#001e40] truncate max-w-xs sm:max-w-md">{exam.title}</h1>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  {exam.type === 'homework' 
                    ? (hasPassageContent ? 'Luyện tập rèn luyện (Study4 style)' : 'Luyện tập PDF + Phiếu câu hỏi') 
                    : (hasPassageContent ? 'Thi thử trực tuyến (Study4 style)' : 'Thi thử PDF + Phiếu câu hỏi')}
                </p>
              </div>
            </div>
            
            <button 
              onClick={confirmExit}
              className="text-[10px] font-extrabold text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl border border-red-200 transition-all flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-xs font-bold">close</span> Thoát
            </button>
          </div>
        </header>

        {/* Top Audio Player Bar if isListening and activeAudioUrl exists */}
        {activeAudioUrl && (
          <div className="px-6 pt-4 shrink-0 bg-transparent">
            <div className="w-full mx-auto bg-indigo-50 border border-indigo-200/85 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-indigo-900 shrink-0">
                <span className="material-symbols-outlined text-lg font-bold">headphones</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider">
                  {isFullTest 
                    ? (currentPart?.audio_url ? `Audio: ${currentPart.part_name}` : 'Audio Toàn Bài Thi') 
                    : 'File nghe bài tập'}
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="flex-grow max-w-full">
                {activeAudioUrl.includes('drive.google.com') || activeAudioUrl.includes('docs.google.com') ? (
                  <iframe
                    key={activeAudioUrl}
                    src={convertGoogleDrivePdfLink(activeAudioUrl)}
                    className="w-full h-[55px] rounded-xl border-0 bg-transparent"
                    allow="autoplay"
                  />
                ) : (
                  <audio
                    key={activeAudioUrl}
                    src={convertGoogleDriveAudioLink(activeAudioUrl)}
                    controls
                    className="w-full h-8 outline-none"
                    controlsList="nodownload"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Split Screen Workspace */}
        <main className="flex-grow flex flex-col lg:flex-row gap-6 p-6 overflow-hidden min-h-0">
          
          {/* COLUMN 1: PASSAGE TEXT OR PDF VIEWER (Left) */}
          <div className="flex-grow bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col lg:h-full relative overflow-hidden min-w-0">
            
            {/* 1. TABS SWAPPER FOR FULL TEST INSIDE SPLIT SCREEN */}
            {isFullTest && (
              <div className="flex overflow-x-auto gap-1 border-b border-slate-200 pb-3 mb-4 shrink-0 max-w-full custom-scrollbar">
                {exam.test_parts.map((p, idx) => (
                  <button
                    key={p.part_code}
                    onClick={() => setActivePartIdx(idx)}
                    className={`px-4 py-2 rounded-xl text-[11px] font-extrabold shrink-0 transition-all ${activePartIdx === idx ? 'bg-[#001e40] text-white shadow-sm font-extrabold' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    {p.part_name}
                  </button>
                ))}
              </div>
            )}

            {/* 3. CONTENT AREA */}
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar min-h-0">
              {hasPassageContent ? (
                <div 
                  className="passage-content select-text"
                  dangerouslySetInnerHTML={{ __html: isFullTest ? currentPart.part_content : exam.passage_text }}
                />
              ) : (
                <iframe 
                  src={convertGoogleDrivePdfLink(exam.pdf_url)} 
                  className="w-full h-full border-none rounded-2xl"
                  title="Exam PDF Document"
                />
              )}
            </div>
          </div>
{/* COLUMN 2: INTERACTIVE BUBBLE SHEET / QUESTIONS LIST (Middle) */}
          <div className="w-full lg:w-[35%] shrink-0 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col lg:h-full overflow-hidden min-w-0">
            <div className="border-b border-slate-150 pb-3 mb-3 shrink-0 flex justify-between items-center">
              <h3 className="font-extrabold text-xs text-[#001e40] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-650 text-base">fact_check</span>
                <span>{isFullTest ? 'Nhập đáp án phần này' : 'Phiếu trả lời (Bubble Sheet)'}</span>
              </h3>
              <span className="text-[9px] font-extrabold text-[#001e40] bg-slate-100 px-2.5 py-1 rounded-full">
                {Object.keys(studentAnswers).filter(k => currentQuestions.some(q => q.id === parseInt(k) || q.id === k)).length} / {currentQuestions.length} câu
              </span>
            </div>

            <div className="flex-grow overflow-y-auto pr-1 space-y-4 custom-scrollbar text-xs min-h-0">
              {(() => {
                return currentQuestions.map((q, idx) => {
                  const selectedOpt = studentAnswers[q.id];
                  const hasOptions = q.options && q.options.length > 0 && q.options.some(opt => opt && opt.trim() && !opt.includes('Đáp án A') && !opt.includes('Đáp án B'));

                  if (hasPassageContent) {
                    const isCorrect = checkQuestionCorrect(q);

                    return (
                      <div
                        key={q.id}
                        id={`q-card-${q.id}`}
                        className={`flex items-center gap-3 py-2.5 px-3 border rounded-xl hover:bg-slate-50 transition-all bg-white shadow-sm border-l-2 hover:border-l-[#001e40] ${
                          isSubmitted
                            ? isCorrect
                              ? 'border-emerald-250 shadow-emerald-50 border-l-emerald-600'
                              : 'border-red-200 shadow-red-50 border-l-red-500'
                            : 'border-slate-100'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full font-extrabold text-[9px] flex items-center justify-center shrink-0 ${
                          isSubmitted
                            ? isCorrect
                              ? 'bg-emerald-50 border border-emerald-500 text-emerald-750'
                              : 'bg-red-50 border border-red-500 text-red-750'
                            : 'bg-[#001e40]/10 text-[#001e40]'
                        }`}>
                          {isFullTest ? q.id : (idx + 1)}
                        </span>

                        <div className="flex-grow min-w-0">
                          {hasOptions && !isListening ? (
                            <div className="w-full">
                              {(() => {
                                const isYesNoNotGiven = q.options.length > 0 && q.options.every(opt => {
                                  const u = opt.trim().toUpperCase();
                                  return u === 'YES' || u === 'NO' || u === 'NOT GIVEN' || u === 'TRUE' || u === 'FALSE';
                                });

                                if (isYesNoNotGiven) {
                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      {q.options.map(opt => {
                                        const val = opt.trim();
                                        const isSelected = selectedOpt === val;
                                        const isCorrectOption = q.correct && q.correct.split('/').map(a => a.trim().toLowerCase()).includes(val.toLowerCase());

                                        let btnClass = "";
                                        if (isSubmitted) {
                                          if (isCorrectOption) {
                                            btnClass = "bg-emerald-600 border-emerald-600 text-white shadow-sm pointer-events-none";
                                          } else if (isSelected) {
                                            btnClass = "bg-red-500 border-red-500 text-white shadow-sm pointer-events-none";
                                          } else {
                                            btnClass = "border-slate-100 text-slate-300 pointer-events-none opacity-50";
                                          }
                                        } else {
                                          btnClass = isSelected
                                            ? 'bg-[#001e40] border-[#001e40] text-white shadow-sm'
                                            : 'border-slate-200 text-slate-450 hover:bg-slate-100';
                                        }

                                        return (
                                          <button
                                            key={val}
                                            disabled={isSubmitted}
                                            onClick={() => selectAnswer(q.id, val)}
                                            className={`px-2.5 py-0.5 rounded-md font-extrabold text-[8px] border transition-all ${btnClass}`}
                                          >
                                            {val}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                return (
                                  <div className="w-full flex flex-col gap-1">
                                    {q.options.map((opt) => {
                                      const optMatch = opt.trim().match(/^([A-K])[\.\-\)\s\u00A0]*\s*(.*)$/i);
                                      const letter = optMatch ? optMatch[1].toUpperCase() : '';
                                      const description = optMatch ? optMatch[2].trim() : opt.trim();
                                      const isSelected = selectedOpt === letter;
                                      const isCorrectOption = q.correct && q.correct.split('/').map(a => a.trim().toLowerCase()).includes(letter.toLowerCase());

                                      let optionClass = "";
                                      if (isSubmitted) {
                                        if (isCorrectOption) {
                                          optionClass = "bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold pointer-events-none";
                                        } else if (isSelected) {
                                          optionClass = "bg-red-50 border-red-500 text-red-950 font-semibold pointer-events-none";
                                        } else {
                                          optionClass = "border-slate-100 text-slate-300 pointer-events-none opacity-50";
                                        }
                                      } else {
                                        optionClass = isSelected
                                          ? 'bg-indigo-50/30 border-indigo-500 text-indigo-950 font-semibold'
                                          : 'border-slate-100 text-slate-600 hover:bg-slate-100/55';
                                      }

                                      return (
                                        <div
                                          key={opt}
                                          onClick={() => !isSubmitted && selectAnswer(q.id, letter || opt)}
                                          className={`flex items-start gap-2 p-1.5 rounded-lg border text-[9px] cursor-pointer transition-all ${optionClass}`}
                                        >
                                          <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border text-[8px] font-extrabold ${
                                            isSubmitted && isCorrectOption
                                              ? 'bg-emerald-600 border-emerald-600 text-white'
                                              : isSelected
                                                ? 'bg-[#001e40] border-[#001e40] text-white shadow-sm'
                                                : 'border-slate-300 text-slate-500 bg-white'
                                          }`}>
                                            {letter}
                                          </span>
                                          <span className="leading-normal pt-0.5">{description}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="w-full">
                              <input
                                type="text"
                                value={studentAnswers[q.id] || ''}
                                onChange={(e) => selectAnswer(q.id, e.target.value)}
                                disabled={isSubmitted}
                                placeholder="Nhập câu trả lời..."
                                className={`w-full border rounded-lg px-2.5 py-1 text-[9px] font-semibold focus:outline-none transition-colors shadow-sm ${
                                  isSubmitted
                                    ? isCorrect
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                                      : 'border-red-500 bg-red-50 text-red-950 font-bold'
                                    : 'border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] bg-white text-slate-850'
                                }`}
                              />
                              {isSubmitted && (
                                <div className="text-[9px] font-bold text-emerald-700 mt-1 pl-1">
                                  Đáp án chính xác: {q.correct}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    // FALLBACK: PDF MODE OR TRADITIONAL SHEET ONLY
                    const isYesNoNotGiven = q.options.length > 0 && q.options.every(opt => {
                      const u = opt.trim().toUpperCase();
                      return u === 'YES' || u === 'NO' || u === 'NOT GIVEN' || u === 'TRUE' || u === 'FALSE';
                    });

                    const optionLetters = q.options.map(opt => {
                      const match = opt.trim().match(/^([A-K])\./i);
                      return match ? match[1].toUpperCase() : null;
                    }).filter(Boolean);
                    const letters = optionLetters.length > 0 ? optionLetters : ['A', 'B', 'C', 'D'];
                    
                    const buttonList = isYesNoNotGiven
                      ? q.options.map(opt => ({ label: opt.trim(), value: opt.trim() }))
                      : letters.map(letter => ({ label: letter, value: letter }));
                    const isCorrect = checkQuestionCorrect(q);

                    return (
                      <div key={q.id} id={`q-card-${q.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-50 gap-2.5 transition-all">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full font-extrabold text-[10px] flex items-center justify-center border shrink-0 ${
                            isSubmitted
                              ? isCorrect
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-750'
                                : 'bg-red-50 border-red-500 text-red-750'
                              : 'bg-slate-100/80 border-slate-200 text-[#001e40]'
                          }`}>
                            {isFullTest ? q.id : (idx + 1)}
                          </span>
                          <span className="font-extrabold text-slate-700 text-[11px] truncate max-w-[150px]">
                            {q.question && q.question.startsWith('Câu') ? q.question : `Câu ${isFullTest ? q.id : (idx + 1)}`}
                          </span>
                        </div>
                        {hasOptions ? (
                          <div className="flex flex-wrap gap-1 shrink-0">
                            {buttonList.map((btn) => {
                              const isSelected = selectedOpt === btn.value;
                              const isCorrectOption = q.correct && q.correct.split('/').map(a => a.trim().toLowerCase()).includes(btn.value.toLowerCase());
                              
                              let btnClass = "";
                              if (isSubmitted) {
                                if (isCorrectOption) {
                                  btnClass = "bg-emerald-600 border-emerald-600 text-white shadow-sm scale-105 pointer-events-none";
                                } else if (isSelected) {
                                  btnClass = "bg-red-500 border-red-500 text-white shadow-sm scale-105 pointer-events-none";
                                } else {
                                  btnClass = "border-slate-100 text-slate-350 pointer-events-none opacity-50";
                                }
                              } else {
                                btnClass = isSelected
                                  ? 'bg-[#001e40] border-[#001e40] text-white shadow-sm scale-105'
                                  : 'border-slate-200 text-slate-450 hover:border-[#001e40] hover:text-[#001e40] hover:bg-slate-50';
                              }

                              return (
                                <button
                                  key={btn.value}
                                  onClick={() => selectAnswer(q.id, btn.value)}
                                  disabled={isSubmitted}
                                  className={`px-2.5 py-1 rounded-lg font-extrabold text-[9px] flex items-center justify-center transition-all border ${btnClass}`}
                                >
                                  {btn.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1 w-full sm:max-w-[160px] shrink-0">
                            <input 
                              type="text"
                              value={studentAnswers[q.id] || ''}
                              onChange={(e) => selectAnswer(q.id, e.target.value)}
                              disabled={isSubmitted}
                              placeholder="Nhập kết quả..."
                              className={`w-full border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none transition-colors shadow-sm ${
                                isSubmitted
                                  ? checkQuestionCorrect(q)
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold focus:ring-emerald-500'
                                    : 'border-red-500 bg-red-50 text-red-950 font-bold focus:ring-red-500'
                                  : 'border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] bg-white text-slate-800'
                              }`}
                            />
                            {isSubmitted && (
                              <div className="text-[9px] font-bold text-emerald-700 w-full text-left pl-1">
                                Key: {q.correct}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                });
              })()}

              {currentQuestions.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-[11px]">
                  Không có câu hỏi cho phần này.
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: STICKY CONTROL & NAVIGATION SIDEBAR (Right) */}
          <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4 lg:h-full overflow-hidden">
            
            {/* Timer card */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-center items-center shadow-sm shrink-0 gap-2">
              <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">
                {useCountdown ? 'Thời gian còn lại' : 'Thời gian làm bài'}
              </span>
              <span className={`font-bold text-2xl font-mono text-[#001e40] ${useCountdown && timeRemaining <= 300 ? 'text-red-500 animate-pulse' : ''}`}>
                {formatTimer()}
              </span>
              
              <button 
                onClick={() => isSubmitted ? setShowResult(true) : handleSubmit(true, false)}
                className={`w-full font-extrabold text-[10px] py-3 rounded-xl transition-all shadow active:scale-97 flex items-center justify-center gap-1 ${
                  isSubmitted 
                    ? 'bg-emerald-650 hover:bg-emerald-750 text-white' 
                    : 'bg-[#001e40] hover:bg-[#003366] text-white'
                }`}
              >
                <span className="material-symbols-outlined text-xs">
                  {isSubmitted ? 'bar_chart' : 'done_all'}
                </span> 
                {isSubmitted ? 'XEM LẠI ĐIỂM SỐ' : 'NỘP BÀI'}
              </button>
            </div>

            {/* Answer Map navigation for entire full test to easily jump sections */}
            {isFullTest && (
              <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col shadow-sm flex-grow min-h-0 overflow-hidden">
                <span className="block text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mb-2 pb-2 border-b border-slate-100 shrink-0">
                  Bản đồ câu hỏi toàn bài
                </span>
                <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar space-y-3.5 min-h-0">
                  {exam.test_parts.map((part, pIdx) => {
                    if (!part.questions || part.questions.length === 0) return null;
                    return (
                      <div key={part.part_code} className="space-y-1.5">
                        <h4 className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider">
                          {part.part_name}
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {part.questions.map((q) => {
                            const isActive = activePartIdx === pIdx;
                            return (
                              <button
                                key={q.id}
                                onClick={() => handleMapClick(pIdx, q.id)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all border shrink-0 ${getButtonColorClass(q, isActive)}`}
                              >
                                {q.id}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Result Modal Overlay */}
        {showResult && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-filter backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

              <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-md shadow-emerald-500/10">
                <span className="material-symbols-outlined text-3xl font-bold">military_tech</span>
              </div>

              <h3 className="font-extrabold text-lg text-primary mb-1">Chúc mừng bạn đã hoàn thành!</h3>
              <p className="text-slate-450 text-[10px] mb-6">Bản ghi kết quả thi của bạn đã được lưu trữ trực tuyến thành công.</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kết quả</span>
                  <span className="font-bold text-lg text-primary">{scoreData.score} / {scoreData.total}</span>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Độ chính xác</span>
                  <span className="font-bold text-lg text-emerald-600">{scoreData.accuracy}%</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl col-span-2 text-center">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Thời gian làm bài</span>
                  <span className="font-bold text-xs text-slate-700">{scoreData.timeTaken} phút</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setShowResult(false)}
                  className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 font-bold rounded-xl text-xs uppercase tracking-wide transition-all shadow-sm active:scale-97 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm font-bold">visibility</span>
                  Xem chi tiết đáp án & bài làm
                </button>
                
                <button 
                  onClick={() => navigate(exam.type === 'homework' ? '/practice' : '/mock-tests')}
                  className="w-full py-2.5 bg-[#001e40] hover:bg-[#003366] text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all shadow-md active:scale-97 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">dashboard</span>
                  Quay lại Bảng điều khiển
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] selection:bg-[#001e40] selection:text-white">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#001e40] text-2xl font-bold">timer</span>
            <div>
              <h1 className="font-extrabold text-sm text-[#001e40] truncate max-w-xs sm:max-w-md">{exam?.title}</h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                {exam?.type === 'homework' ? 'Chế độ: Bài tập ôn luyện' : 'Chế độ: Thi thử Full Test'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={confirmExit}
            className="text-[10px] font-extrabold text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl border border-red-200 transition-all flex items-center gap-1 active:scale-95"
          >
            <span className="material-symbols-outlined text-xs font-bold">close</span> Thoát
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1440px] mx-auto w-full px-6 py-8 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SIDE: QUESTIONS & AUDIO (Col 1-8) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 1. GIAO DIỆN TABS CHO ĐỀ FULL TEST CHUẨN STUDY4 */}
            {isFullTest && (
              <div className="flex overflow-x-auto gap-1 border-b border-slate-200 pb-1.5 mb-4 max-w-full">
                {exam.test_parts.map((p, idx) => (
                  <button
                    key={p.part_code}
                    onClick={() => setActivePartIdx(idx)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${activePartIdx === idx ? 'bg-[#001e40] text-white shadow-sm font-extrabold' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    {p.part_name}
                  </button>
                ))}
              </div>
            )}

            {/* 2. BỘ PHÁT NHẠC AUDIO CHO PART HIỆN TẠI (Độc lập từng phần chuẩn Study4) */}
            {activeAudioUrl && (
              <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-[80px] z-20 backdrop-blur-md mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#001e40] text-white flex items-center justify-center shrink-0 shadow-md">
                    <span className="material-symbols-outlined text-lg">headphones</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[#001e40] uppercase tracking-wide flex items-center gap-1.5">
                      <span>{isFullTest ? (currentPart?.audio_url ? `Phần nghe: ${currentPart.part_name}` : 'Audio Toàn Bài Thi') : 'Phần nghe (Listening Audio)'}</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </h4>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">Bấm phát audio và nghe để làm trắc nghiệm tương ứng bên dưới.</p>
                  </div>
                </div>
                
                <div className="flex-grow max-w-md w-full">
                  {activeAudioUrl.includes('drive.google.com') || activeAudioUrl.includes('docs.google.com') ? (
                    <iframe
                      key={activeAudioUrl}
                      src={convertGoogleDrivePdfLink(activeAudioUrl)}
                      className="w-full h-[55px] rounded-xl border-0 bg-transparent"
                      allow="autoplay"
                    />
                  ) : (
                    <audio 
                      key={activeAudioUrl}
                      src={convertGoogleDriveAudioLink(activeAudioUrl)} 
                      controls 
                      className="w-full h-8 rounded-lg outline-none cursor-pointer"
                      controlsList="nodownload"
                    />
                  )}
                </div>
              </div>
            )}

            {/* 3. HIỂN THỊ CÂU HỎI CỦA PHẦN HIỆN TẠI */}
            <div className="space-y-6">
              {currentQuestions.map((q, idx) => {
                const selectedOpt = studentAnswers[q.id];
                const hasOptions = q.options && q.options.length > 0;
                const isCorrect = checkQuestionCorrect(q);

                return (
                  <div 
                    key={q.id} 
                    id={`q-card-${q.id}`} 
                    className={`bg-white border rounded-2xl p-6 shadow-sm space-y-4 transition-all ${
                      isSubmitted
                        ? isCorrect
                          ? 'border-emerald-200 shadow-emerald-50'
                          : 'border-red-200 shadow-red-50'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-extrabold border ${
                        isSubmitted
                          ? isCorrect
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-750'
                            : 'bg-red-50 border-red-500 text-red-750'
                          : 'bg-[#001e40]/10 border-[#001e40]/20 text-[#001e40]'
                      }`}>
                        Câu {isFullTest ? q.id : (idx + 1)}
                      </span>
                      {isSubmitted && (
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                          isCorrect ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          <span className="material-symbols-outlined text-sm font-bold">
                            {isCorrect ? 'check_circle' : 'cancel'}
                          </span>
                          {isCorrect ? 'Đúng' : 'Sai'}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-800 text-sm leading-relaxed">{q.question}</p>
                    
                    {hasOptions ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        {q.options.map((opt, oIdx) => {
                          const trimmed = opt.trim();
                          const optMatch = trimmed.match(/^([A-E])[\.\-\)\s]/i);
                          const letter = optMatch ? optMatch[1].toUpperCase() : trimmed;
                          const isSelected = selectedOpt === letter;
                          const isCorrectOption = q.correct && q.correct.split('/').map(a => a.trim().toLowerCase()).includes(letter.toLowerCase());

                          let optionClass = "";
                          if (isSubmitted) {
                            if (isCorrectOption) {
                              optionClass = "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold pointer-events-none";
                            } else if (isSelected) {
                              optionClass = "bg-red-50 border-red-500 text-red-950 font-bold pointer-events-none";
                            } else {
                              optionClass = "border-slate-100 text-slate-350 pointer-events-none opacity-50";
                            }
                          } else {
                            optionClass = isSelected
                              ? "bg-indigo-50/50 border-[#001e40] text-[#001e40] font-bold"
                              : "border-slate-100 hover:bg-slate-50 text-slate-700";
                          }

                          return (
                            <label 
                              key={oIdx}
                              onClick={() => !isSubmitted && selectAnswer(q.id, letter)}
                              className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors select-none text-xs font-semibold ${optionClass}`}
                            >
                              <input 
                                type="radio" 
                                name={`question-${q.id}`} 
                                value={letter} 
                                checked={isSelected}
                                disabled={isSubmitted}
                                onChange={() => {}}
                                className={`focus:ring-[#001e40] border-slate-300 w-4 h-4 ${
                                  isSubmitted
                                    ? isCorrectOption
                                      ? 'text-emerald-600 focus:ring-emerald-500'
                                      : 'text-red-500 focus:ring-red-500'
                                    : 'text-[#001e40]'
                                }`}
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <input 
                          type="text"
                          value={studentAnswers[q.id] || ''}
                          onChange={(e) => selectAnswer(q.id, e.target.value)}
                          disabled={isSubmitted}
                          placeholder="Nhập kết quả điền từ..."
                          className={`w-full max-w-md border rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none transition-colors shadow-sm ${
                            isSubmitted
                              ? isCorrect
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold focus:ring-emerald-500'
                                : 'border-red-500 bg-red-50 text-red-950 font-bold focus:ring-red-500'
                              : 'border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] bg-white text-slate-800'
                          }`}
                        />
                        {isSubmitted && (
                          <div className="text-xs font-bold text-emerald-700 pl-1">
                            Đáp án chính xác: {q.correct}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {currentQuestions.length === 0 && (
                <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
                  <span className="material-symbols-outlined text-3xl block mb-2">info</span>
                  Không có câu hỏi hiển thị cho phần đề này.
                </div>
              )}
            </div>

          </div>

          {/* RIGHT SIDE: TIMER & MAP (Col 9-12) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 sticky top-24 space-y-6 shadow-sm">
            
            {/* Đồng hồ */}
            <div className="text-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                {useCountdown ? 'Thời gian còn lại' : 'Thời gian làm bài'}
              </span>
              <span className={`font-bold text-3xl font-mono text-[#001e40] ${useCountdown && timeRemaining <= 300 ? 'text-red-500 animate-pulse' : ''}`}>
                {formatTimer()}
              </span>
            </div>

            {/* Bản đồ câu hỏi gom cụm theo từng Part giống hệt thiết kế Study4 */}
            <div className="space-y-4">
              <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Bản đồ câu hỏi</span>
              
              <div className="max-h-[300px] overflow-y-auto space-y-4 pr-1">
                {isFullTest ? (
                  exam.test_parts.map((part, pIdx) => {
                    if (part.questions.length === 0) return null;
                    return (
                      <div key={part.part_code} className="space-y-2">
                        <h4 className="text-[9px] font-extrabold text-[#001e40] uppercase tracking-wider">{part.part_name}</h4>
                        <div className="grid grid-cols-5 gap-2">
                          {part.questions.map((q) => {
                            return (
                              <button
                                key={q.id}
                                onClick={() => handleMapClick(pIdx, q.id)}
                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all border shrink-0 ${getButtonColorClass(q, false)}`}
                              >
                                {q.id}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {exam?.questions.map((q, idx) => {
                      return (
                        <button
                          key={q.id}
                          onClick={() => {
                            const el = document.getElementById(`q-card-${q.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              el.classList.add('border-primary', 'shadow-md');
                              setTimeout(() => el.classList.remove('border-primary', 'shadow-md'), 1500);
                            }
                          }}
                          className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all border shrink-0 ${getButtonColorClass(q, false)}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Nút nộp bài */}
            <div className="pt-4 border-t border-slate-200">
              <button 
                onClick={() => isSubmitted ? setShowResult(true) : handleSubmit(true, false)}
                className={`w-full py-2.5 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-97 flex items-center justify-center gap-2 ${
                  isSubmitted 
                    ? 'bg-emerald-650 hover:bg-emerald-750 text-white' 
                    : 'bg-[#001e40] hover:bg-[#003366] text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm font-bold">
                  {isSubmitted ? 'bar_chart' : 'done_all'}
                </span>
                <span>{isSubmitted ? 'Xem lại điểm số' : 'Nộp bài thi'}</span>
              </button>
              <p className="text-[8px] text-slate-400 text-center mt-2 italic">Dữ liệu kết quả sẽ tự động đồng bộ lên Supabase.</p>
            </div>

          </div>

        </div>
      </main>

      {/* RESULT MODAL OVERLAY */}
      {showResult && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-filter backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

            <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-md shadow-emerald-500/10">
              <span className="material-symbols-outlined text-3xl font-bold">military_tech</span>
            </div>

            <h3 className="font-extrabold text-lg text-primary mb-1">Chúc mừng bạn đã hoàn thành!</h3>
            <p className="text-slate-450 text-[10px] mb-6">Bản ghi kết quả thi của bạn đã được lưu trữ trực tuyến thành công.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kết quả</span>
                <span className="font-bold text-lg text-primary">{scoreData.score} / {scoreData.total}</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Độ chính xác</span>
                <span className="font-bold text-lg text-emerald-600">{scoreData.accuracy}%</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl col-span-2 text-center">
                <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Thời gian làm bài</span>
                <span className="font-bold text-xs text-slate-700">{scoreData.timeTaken} phút</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setShowResult(false)}
                className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 font-bold rounded-xl text-xs uppercase tracking-wide transition-all shadow-sm active:scale-97 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm font-bold">visibility</span>
                Xem chi tiết đáp án & bài làm
              </button>
              
              <button 
                onClick={() => navigate(exam?.type === 'homework' ? '/practice' : '/mock-tests')}
                className="w-full py-2.5 bg-[#001e40] hover:bg-[#003366] text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all shadow-md active:scale-97 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">dashboard</span>
                Quay lại Bảng điều khiển
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExamTaker;
