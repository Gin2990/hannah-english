import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      initDashboardData();
    }
  }, [user]);

  const initDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Lấy thông tin profiles học viên để lấy class_id
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('class_id, full_name')
        .eq('id', user.id)
        .single();
      
      if (profileErr) throw profileErr;
      setProfile(profileData);

      // 2. Lấy danh sách kết quả làm bài của học viên
      const { data: resultsData, error: resultsErr } = await supabase
        .from('exam_results')
        .select(`
          id,
          score,
          total_questions,
          taken_at,
          exam_id,
          exams (
            title,
            course_id,
            type,
            courses (
              code,
              title
            )
          )
        `)
        .eq('student_id', user.id)
        .order('taken_at', { ascending: false });

      if (resultsErr) throw resultsErr;
      setExamResults(resultsData || []);

      // 3. Lấy danh sách bài tập được giao cho học viên này (hoặc giao cho lớp của học viên)
      // Join thêm thông tin giáo viên giao bài từ bảng profiles!assignments_created_by_fkey
      let assignQuery = supabase
        .from('assignments')
        .select(`
          id,
          due_date,
          exam_id,
          class_id,
          created_at,
          exams (
            id,
            title,
            type,
            duration,
            question_count,
            course_id,
            courses (
              code,
              title
            )
          ),
          profiles!assignments_created_by_fkey (
            full_name
          )
        `);

      if (profileData?.class_id) {
        assignQuery = assignQuery.or(`student_id.eq.${user.id},class_id.eq.${profileData.class_id}`);
      } else {
        assignQuery = assignQuery.eq('student_id', user.id);
      }

      const { data: assignData, error: assignErr } = await assignQuery;
      if (assignErr) throw assignErr;

      setAssignments(assignData || []);
    } catch (err) {
      console.error("Lỗi lấy thông tin học tập của học viên:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (exam) => {
    if (exam.type === 'homework') {
      navigate(`/practice-intro/${exam.id}`);
    } else {
      if (window.confirm("🔔 Bạn đã sẵn sàng bước vào phòng thi thử?\nĐồng hồ đếm ngược nghiêm ngặt sẽ kích hoạt ngay khi bạn nhấn Bắt đầu.")) {
        navigate(`/exam-taker/${exam.id}`);
      }
    }
  };

  // Tính toán các nhóm bài tập và thông báo dựa trên dữ liệu thật
  const completedExamIds = new Set(examResults.map(r => r.exam_id));

  // 1. Bài cần hoàn thành (Chưa làm, bao gồm cả bài trong hạn và quá hạn)
  const pendingAssignments = assignments.filter(ass => {
    if (!ass.exams) return false;
    return !completedExamIds.has(ass.exam_id);
  });

  // 2. Bài quá hạn (Chưa làm, hạn nộp ở quá khứ)
  const overdueAssignments = assignments.filter(ass => {
    if (!ass.exams) return false;
    if (completedExamIds.has(ass.exam_id)) return false;
    if (!ass.due_date) return false;
    return new Date(ass.due_date) < new Date();
  });

  // 3. Tạo thông báo động từ cơ sở dữ liệu
  const buildNotifications = () => {
    const list = [];

    // Lọc bài tập được giao mới (trong vòng 7 ngày qua)
    assignments.forEach(ass => {
      if (!ass.exams) return;
      const createdDate = new Date(ass.created_at);
      const diffTime = Math.abs(new Date() - createdDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        const creatorName = ass.profiles?.full_name || "Giáo viên";
        const examTitle = ass.exams.title;
        const target = ass.class_id ? "lớp" : "bạn";
        list.push({
          type: 'new_assignment',
          message: `Giảng viên ${creatorName} vừa giao bài tập "${examTitle}" cho ${target}.`,
          date: createdDate,
          icon: 'assignment',
          iconColor: 'text-blue-600 bg-blue-50'
        });
      }
    });

    // Lọc cảnh báo bài quá hạn
    overdueAssignments.forEach(ass => {
      if (!ass.exams) return;
      const examTitle = ass.exams.title;
      const dueDateLabel = new Date(ass.due_date).toLocaleString('vi-VN');
      list.push({
        type: 'overdue',
        message: `Bạn chưa hoàn thành bài tập "${examTitle}" đúng hạn (Hạn chót: ${dueDateLabel}).`,
        date: new Date(ass.due_date),
        icon: 'warning',
        iconColor: 'text-rose-600 bg-rose-50'
      });
    });

    // Lọc lịch sử làm bài xong
    examResults.slice(0, 5).forEach(res => {
      if (!res.exams) return;
      const examTitle = res.exams.title;
      const takenDate = new Date(res.taken_at);
      list.push({
        type: 'completed',
        message: `Bạn đã hoàn thành bài tập "${examTitle}" đạt điểm số ${res.score}/${res.total_questions}.`,
        date: takenDate,
        icon: 'check_circle',
        iconColor: 'text-emerald-600 bg-emerald-50'
      });
    });

    // Sắp xếp thông báo mới nhất lên đầu
    return list.sort((a, b) => b.date - a.date);
  };

  const notifications = buildNotifications();
  const firstName = user?.full_name ? user.full_name.split(' ').pop() : 'Học viên';

  if (loading) {
    return (
      <div className="bg-[#f8f9fa] min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#001e40] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Đang kết nối dữ liệu học tập...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] min-h-[calc(100vh-64px)] flex flex-col font-sans selection:bg-indigo-900 selection:text-white">
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 py-12 space-y-8 animate-fade-in font-semibold">
        
        {/* Welcome Block */}
        <section className="bg-[#001e40] text-white p-8 rounded-3xl shadow-sm border border-indigo-950 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-1 z-10">
            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-[10px] font-extrabold text-blue-300 uppercase tracking-widest">
              Student Dashboard
            </span>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight mt-1">Chào ngày mới, {firstName}!</h1>
            <p className="text-slate-300 text-xs">Chào mừng bạn quay trở lại. Hãy rà soát bài tập cần làm hôm nay nhé!</p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#003366] flex items-center justify-center font-bold text-xs text-white">HV</div>
            <div>
              <p className="text-xs font-bold">{user?.full_name}</p>
              <span className="text-[9px] text-blue-300 font-bold uppercase tracking-wider">Hannah English Student</span>
            </div>
          </div>
        </section>

        {/* Warning Banner for Overdue Assignments */}
        {overdueAssignments.length > 0 && (
          <div className="bg-rose-50/70 border border-rose-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm animate-shake">
            <span className="material-symbols-outlined text-rose-600 font-bold text-2xl animate-pulse">error</span>
            <div className="space-y-1 flex-grow">
              <h4 className="text-rose-850 font-extrabold text-sm">Cảnh báo bài tập quá hạn nộp!</h4>
              <p className="text-rose-700 text-xs font-semibold leading-relaxed">
                Bạn đang có <span className="font-extrabold text-rose-850 underline">{overdueAssignments.length} bài tập</span> quá hạn nộp nhưng chưa hoàn thành. Vui lòng bấm vào danh sách bài để hoàn thiện sớm nhất có thể.
              </p>
              <div className="mt-3 space-y-1.5">
                {overdueAssignments.map(ass => (
                  <div key={ass.id} className="flex justify-between items-center bg-white/40 border border-rose-200/50 rounded-xl px-3 py-1.5 text-xs text-rose-850">
                    <span className="font-bold truncate max-w-[70%]">[{ass.exams.courses.code.toUpperCase()}] {ass.exams.title}</span>
                    <span className="font-extrabold text-[10px] uppercase text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-0.5">
                      Hạn chót: {new Date(ass.due_date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Assignments To Do (col-span-8) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
            
            {/* Pending Assignments */}
            <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-display text-base font-bold text-[#001e40]">Bài Tập Cần Hoàn Thành</h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">Danh sách các bài tập giáo viên giao cần bạn hoàn thành sớm.</p>
                </div>
                <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full font-bold text-[10px] text-indigo-700">
                  {pendingAssignments.length} bài tập
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {pendingAssignments.map(ass => {
                  const exam = ass.exams;
                  const isTest = exam.type === 'test';
                  const courseLabel = exam.courses.code.toUpperCase();
                  const isOverdue = ass.due_date && new Date(ass.due_date) < new Date();
                  const dueDateLabel = ass.due_date 
                    ? `Hạn nộp: ${new Date(ass.due_date).toLocaleString('vi-VN')}` 
                    : 'Không giới hạn thời gian nộp';

                  return (
                    <div key={ass.id} className="p-6 hover:bg-slate-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2 min-w-0 flex-grow">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider ${
                            isTest ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {courseLabel} • {isTest ? 'Thi thử' : 'Luyện tập'}
                          </span>
                          <span className={`text-[10px] font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            {dueDateLabel} {isOverdue && '• QUÁ HẠN'}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-[#001e40] leading-snug truncate" title={exam.title}>
                          {exam.title}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-slate-450 font-bold">
                          <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">schedule</span> {exam.duration || "unlimited"} phút</span>
                          <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">quiz</span> {exam.question_count} câu hỏi</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartExam(exam)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0 ${
                          isTest ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#001e40] hover:bg-[#003366]'
                        }`}
                      >
                        <span>Làm bài ngay</span>
                        <span className="material-symbols-outlined text-xs font-bold">arrow_forward</span>
                      </button>
                    </div>
                  );
                })}

                {pendingAssignments.length === 0 && (
                  <div className="py-16 text-center text-slate-450 font-semibold space-y-2">
                    <span className="material-symbols-outlined text-4xl text-emerald-500 animate-bounce">verified</span>
                    <h4 className="text-slate-800 text-sm font-extrabold">Tuyệt vời! Bạn đã hoàn thành tất cả bài tập</h4>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto">Không có bài tập nào đang chờ xử lý. Hãy tiếp tục ôn tập tự do ở các mục bên trên.</p>
                  </div>
                )}
              </div>
            </section>
            
          </div>

          {/* Right Column: Activity Notifications (col-span-4) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
            
            {/* Activity Notifications */}
            <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-display text-xs font-extrabold uppercase tracking-widest text-[#001e40]">Thông báo hoạt động</h3>
                <span className="material-symbols-outlined text-slate-400 text-lg">notifications</span>
              </div>
              <div className="p-5 max-h-[300px] overflow-y-auto custom-preview-scrollbar space-y-4">
                {notifications.map((notif, idx) => (
                  <div key={idx} className="flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <span className={`material-symbols-outlined text-lg p-2 rounded-xl shrink-0 ${notif.iconColor}`}>
                      {notif.icon}
                    </span>
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="text-[11px] font-bold text-slate-700 leading-normal">{notif.message}</p>
                      <span className="text-[9px] text-slate-400 font-semibold block">
                        {new Date(notif.date).toLocaleDateString('vi-VN')} {new Date(notif.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <p className="text-xs text-slate-400 italic py-8 text-center font-semibold">Chưa có thông báo hoạt động nào.</p>
                )}
              </div>
            </section>

          </div>

        </div>

        {/* Full-width Score History Section */}
        <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="font-display text-base font-bold text-[#001e40]">Lịch Sử Kết Quả Luyện Thi</h3>
              <p className="text-slate-400 text-[10px] mt-0.5">Bảng thống kê điểm số và quá trình làm bài của bạn trên hệ thống.</p>
            </div>
            <span className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full font-bold text-[10px] text-blue-700">
              Đã làm {examResults.length} bài
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Đề thi / Bài tập</th>
                  <th className="py-3.5 px-6">Khóa học</th>
                  <th className="py-3.5 px-6">Thời gian nộp</th>
                  <th className="py-3.5 px-6">Đúng / Tổng câu</th>
                  <th className="py-3.5 px-6">Độ chính xác</th>
                  <th className="py-3.5 px-6 text-right">Điểm quy đổi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {examResults.map((attempt, idx) => {
                  const accuracy = attempt.total_questions > 0 ? Math.round((attempt.score / attempt.total_questions) * 100) : 0;
                  const dateStr = new Date(attempt.taken_at).toLocaleString('vi-VN', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  const isToeic = attempt.exams?.courses?.code?.toLowerCase() === 'toeic';
                  const scoreDisplay = isToeic ? `${Math.round(accuracy * 9.9)}` : `${(accuracy / 10).toFixed(1)}`;
                  const exam = attempt.exams;
                  const isTest = exam?.type === 'test';
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-50/30 transition-all">
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider ${
                            isTest ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {isTest ? 'Thi thử' : 'Luyện tập'}
                          </span>
                          <p className="font-bold text-[#001e40] mt-1">{exam?.title || "Đề thi đã xóa"}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {exam?.courses?.title || 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-slate-450">
                        {dateStr}
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-600">
                        {attempt.score} / {attempt.total_questions}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 max-w-[120px]">
                          <div className="flex-grow h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${accuracy >= 80 ? 'bg-emerald-500' : accuracy >= 50 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                              style={{ width: `${accuracy}%` }}
                            />
                          </div>
                          <span className="font-extrabold text-[10px] text-slate-500 shrink-0">{accuracy}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-extrabold text-[#001e40] text-sm">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg border border-indigo-150">
                          {scoreDisplay} {isToeic ? 'Điểm' : 'Band'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {examResults.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400 italic font-semibold">
                      Bạn chưa hoàn thành bài thi trực tuyến nào trên hệ thống.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
};

export default StudentDashboard;
