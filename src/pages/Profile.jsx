import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

const Profile = () => {
  const { user, logout, refreshUser } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Dynamic statistics
  const [stats, setStats] = useState({
    totalExams: 0,
    averageScore: 0,
    totalMinutes: 0,
    streakDays: 14
  });

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch test results
      const { data: results, error } = await supabase
        .from('exam_results')
        .select(`
          id,
          score,
          total_questions,
          duration_seconds,
          taken_at,
          exams (
            title
          )
        `)
        .eq('student_id', user.id)
        .order('taken_at', { ascending: false });

      if (error) throw error;

      setHistory(results || []);

      // 2. Compute aggregate values
      if (results && results.length > 0) {
        const total = results.length;
        const totalSecs = results.reduce((acc, curr) => acc + curr.duration_seconds, 0);
        const mins = Math.ceil(totalSecs / 60);

        // Average score (scaled to 10)
        const avgPct = results.reduce((acc, curr) => acc + (curr.score / curr.total_questions), 0) / total;
        const avgScore = (avgPct * 10).toFixed(1);

        setStats({
          totalExams: total,
          averageScore: parseFloat(avgScore),
          totalMinutes: mins,
          streakDays: results.length * 3 + 2 // Simulated dynamic streak
        });
      }
    } catch (err) {
      console.error("Lỗi đồng bộ hồ sơ học sinh:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = async () => {
    const newName = prompt("Nhập họ và tên mới của bạn:", user?.full_name || '');
    if (!newName || newName.trim() === user?.full_name) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName.trim() })
        .eq('id', user.id);

      if (error) throw error;
      alert("🎉 Cập nhật tên mới thành công!");
      refreshUser();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi lưu tên mới: " + err.message);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?")) {
      logout();
      navigate('/auth');
    }
  };

  // Badge unlock check rules
  const hasFirstTest = history.length > 0;
  const hasHighScore = history.some(item => (item.score / item.total_questions) >= 0.8);
  const hasPersistent = stats.totalMinutes >= 15;

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] min-h-[calc(100vh-64px)] flex flex-col font-sans">
      <main className="max-w-[1440px] mx-auto w-full px-6 py-12 flex-grow space-y-8 animate-fade-in">
        
        {/* User Profile Header Section */}
        <section className="bg-white border border-[#c3c6d1] rounded-2xl p-6 flex flex-col md:flex-row gap-8 items-center md:items-start shadow-sm">
          
          {/* Circular avatar border */}
          <div className="relative shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#003366] overflow-hidden p-1 bg-white">
              <img 
                alt="User Profile Big" 
                className="w-full h-full object-cover rounded-full" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgqficCga9IDhl_KygQdfdv_UnG-4I_Kv1iWNvI4xsqGjuPo1W6iFNjSbaR0B3zFESkkRddXtH6_h-0hqLfBMWtbb4EL-mOn7ytVXFrbRwuy8x43uJU7ssskd2NFg-61dHiyNXOuX6ea8OqiglFZJH3mKKdTZH2Y343p2xTy_T8tRGbITsk2r2rvl6EBEp_o7QqkaE0wZagJJz8K3wdP_NXsQjIVNTYBqExRpvAh5NooCBOVrxixb-eFUNWq0OTGfJa1yuYLcb5jfP"
              />
            </div>
            <div className="absolute bottom-2 right-2 bg-[#001e40] text-white rounded-full p-2 border-2 border-white shadow-md flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] font-bold">verified</span>
            </div>
          </div>

          {/* User Meta Information */}
          <div className="flex-grow text-center md:text-left space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#001e40] leading-tight">
                {user?.full_name || 'Học viên'}
              </h1>
              <span className="bg-[#003366] text-white px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider self-center md:self-auto shadow-sm">
                Elite Learner
              </span>
            </div>
            
            <p className="text-[#5d5e5f] text-xs font-semibold">
              ID: SP-2026-{user?.id?.substring(0, 5).toUpperCase()} • Cấp độ: IELTS Advanced / TOEIC Master
            </p>
            
            {/* Quick Achievements Tagging */}
            <div className="flex flex-wrap justify-center md:justify-start gap-2.5">
              <div className="flex items-center gap-1.5 bg-[#f3f4f5] px-3 py-1.5 rounded-xl border border-[#c3c6d1] text-xs font-bold text-[#001e40]">
                <span className="material-symbols-outlined text-[#001e40] text-sm">stars</span>
                <span>Kẻ hủy diệt Reading</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#f3f4f5] px-3 py-1.5 rounded-xl border border-[#c3c6d1] text-xs font-bold text-[#001e40]">
                <span className="material-symbols-outlined text-[#001e40] text-sm">workspace_premium</span>
                <span>Chúa tể Writing</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
            <button 
              onClick={handleEditProfile}
              className="bg-[#001e40] hover:bg-[#003366] text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm font-bold">edit</span>
              <span>Chỉnh sửa hồ sơ</span>
            </button>
            <button 
              onClick={() => alert("🔗 Đã sao chép liên kết hồ sơ của bạn vào clipboard!")}
              className="border border-[#001e40] text-[#001e40] bg-white font-bold text-xs px-6 py-3 rounded-xl hover:bg-[#f3f4f5] transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm font-bold">share</span>
              <span>Chia sẻ thành tích</span>
            </button>
          </div>
        </section>

        {/* Dynamic Statistics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-[#c3c6d1] p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:border-[#001e40] transition-colors">
            <div className="h-12 w-12 bg-[#d5e3ff] text-[#001b3c] rounded-xl flex items-center justify-center shrink-0 border border-blue-150">
              <span className="material-symbols-outlined text-xl font-bold">assignment_turned_in</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#5d5e5f] uppercase tracking-wider">Tổng bài thi</p>
              <p className="font-display font-extrabold text-2xl text-[#001e40]">{stats.totalExams}</p>
            </div>
          </div>

          <div className="bg-white border border-[#c3c6d1] p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:border-[#001e40] transition-colors">
            <div className="h-12 w-12 bg-[#d5e3ff] text-[#001b3c] rounded-xl flex items-center justify-center shrink-0 border border-blue-150">
              <span className="material-symbols-outlined text-xl font-bold">schedule</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#5d5e5f] uppercase tracking-wider">Số phút đã luyện</p>
              <p className="font-display font-extrabold text-2xl text-[#001e40]">{stats.totalMinutes}m</p>
            </div>
          </div>

          <div className="bg-white border border-[#c3c6d1] p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:border-[#001e40] transition-colors">
            <div className="h-12 w-12 bg-[#d5e3ff] text-[#001b3c] rounded-xl flex items-center justify-center shrink-0 border border-blue-150">
              <span className="material-symbols-outlined text-xl font-bold">grade</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#5d5e5f] uppercase tracking-wider">Điểm trung bình</p>
              <p className="font-display font-extrabold text-2xl text-[#001e40]">{stats.averageScore || '0.0'}/10</p>
            </div>
          </div>

          <div className="bg-white border border-[#c3c6d1] p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:border-[#001e40] transition-colors">
            <div className="h-12 w-12 bg-[#d5e3ff] text-[#001b3c] rounded-xl flex items-center justify-center shrink-0 border border-blue-150">
              <span className="material-symbols-outlined text-xl font-bold">local_fire_department</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#5d5e5f] uppercase tracking-wider">Chuỗi học tập</p>
              <p className="font-display font-extrabold text-2xl text-[#001e40]">{stats.streakDays} ngày</p>
            </div>
          </div>
        </section>

        {/* Detailed Layout: Left Activity & Achievements, Right Account Nav */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Block (col-span-2) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Activity History table */}
            <section className="bg-white border border-[#c3c6d1] rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-display text-sm font-extrabold text-[#001e40] uppercase tracking-wider">Lịch sử luyện tập trực tuyến</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f3f4f5] border-b border-[#c3c6d1] text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Tên đề thi / bài làm</th>
                      <th className="px-6 py-3.5 text-center">Kết quả</th>
                      <th className="px-6 py-3.5 text-right">Ngày nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                    {loading ? (
                      <tr>
                        <td colSpan="3" className="text-center py-12 text-slate-400">
                          <div className="w-6 h-6 border-2 border-[#001e40] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Đang kết nối đồng bộ Supabase...
                        </td>
                      </tr>
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center py-12 text-[#5d5e5f] italic">
                          Chưa có lịch sử làm bài thi thử nào trên hệ thống.
                        </td>
                      </tr>
                    ) : (
                      history.map(item => {
                        const scoreStr = `${item.score} / ${item.total_questions}`;
                        const dateStr = new Date(item.taken_at).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        });

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-[#001e40]">{item.exams?.title || 'Đề thi đã xóa'}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-[#003366] text-white px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold shadow-sm">
                                {scoreStr}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-500 font-semibold">{dateStr}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Achievements & Badges */}
            <section className="bg-white border border-[#c3c6d1] rounded-2xl p-6 shadow-sm">
              <h2 className="font-display font-extrabold text-sm text-[#001e40] uppercase tracking-wider mb-6">Thành tích học tập đạt được</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                
                {/* Badge 1: Fast Learner */}
                <div className={`flex flex-col items-center text-center group cursor-pointer transition-all ${hasFirstTest ? '' : 'opacity-35 select-none'}`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-all ${hasFirstTest ? 'bg-[#003366] text-white shadow-md' : 'bg-[#e1e3e4] text-[#5d5e5f]'}`}>
                    <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                  </div>
                  <p className={`text-xs font-bold ${hasFirstTest ? 'text-[#001e40]' : 'text-slate-400'}`}>Tân Binh Luyện Đề</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">Làm tối thiểu 1 đề</p>
                </div>

                {/* Badge 2: The Strategist */}
                <div className={`flex flex-col items-center text-center group cursor-pointer transition-all ${hasHighScore ? '' : 'opacity-35 select-none'}`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-all ${hasHighScore ? 'bg-[#003366] text-white shadow-md' : 'bg-[#e1e3e4] text-[#5d5e5f]'}`}>
                    <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                  </div>
                  <p className={`text-xs font-bold ${hasHighScore ? 'text-[#001e40]' : 'text-slate-400'}`}>Cao Thủ IELTS/TOEIC</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">Độ chính xác ≥ 80%</p>
                </div>

                {/* Badge 3: Trophy Tracker */}
                <div className={`flex flex-col items-center text-center group cursor-pointer transition-all ${hasPersistent ? '' : 'opacity-35 select-none'}`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-all ${hasPersistent ? 'bg-[#003366] text-white shadow-md' : 'bg-[#e1e3e4] text-[#5d5e5f]'}`}>
                    <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>trophy</span>
                  </div>
                  <p className={`text-xs font-bold ${hasPersistent ? 'text-[#001e40]' : 'text-slate-400'}`}>Chiến Binh Bền Bỉ</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">Tích lũy học &gt; 15 phút</p>
                </div>

                {/* Badge 4: Master Scribe */}
                <div className="flex flex-col items-center text-center opacity-35 select-none cursor-pointer">
                  <div className="w-16 h-16 bg-[#e1e3e4] text-[#5d5e5f] rounded-full flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[32px]">history_edu</span>
                  </div>
                  <p className="text-xs font-bold text-slate-450">Top 1% Học Viên</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">Chưa mở khóa</p>
                </div>

              </div>
            </section>
          </div>

          {/* Right Block Settings sidebar (col-span-1) */}
          <div className="space-y-6">
            
            {/* Account Settings Nav */}
            <section className="bg-white border border-[#c3c6d1] rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-[#c3c6d1] bg-slate-50/50">
                <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#001e40]">Cài đặt tài khoản</h2>
              </div>
              <nav className="p-2 space-y-1">
                <button 
                  onClick={handleEditProfile}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#f3f4f5] transition-colors text-left text-xs font-bold text-[#191c1d] group"
                >
                  <span className="material-symbols-outlined text-[#5d5e5f] group-hover:text-[#001e40]">person</span>
                  <span className="flex-grow">Cập nhật họ và tên</span>
                  <span className="material-symbols-outlined text-[#c3c6d1]">chevron_right</span>
                </button>

                <button 
                  onClick={() => alert("Tính năng đổi mật khẩu đang hoạt động bảo trì trực tuyến.")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#f3f4f5] transition-colors text-left text-xs font-bold text-[#191c1d] group"
                >
                  <span className="material-symbols-outlined text-[#5d5e5f] group-hover:text-[#001e40]">lock_reset</span>
                  <span className="flex-grow">Đổi mật khẩu</span>
                  <span className="material-symbols-outlined text-[#c3c6d1]">chevron_right</span>
                </button>

                <button 
                  onClick={() => handleLogout()}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors text-left text-xs font-bold text-red-600 group border-t border-slate-100"
                >
                  <span className="material-symbols-outlined text-red-500">logout</span>
                  <span className="flex-grow">Đăng xuất hệ thống</span>
                </button>
              </nav>
            </section>

            {/* Study Progress Goals card */}
            <section className="bg-[#001e40] text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none"></div>
              <h3 className="font-display font-extrabold text-sm mb-6 relative z-10">Tiến trình tuần này</h3>
              
              <div className="space-y-4 relative z-10 text-xs font-bold">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-350">
                    <span>Mục tiêu Reading</span>
                    <span>75%</span>
                  </div>
                  <div className="w-full bg-[#003366] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-white h-full" style={{ width: "75%" }}></div>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-350">
                    <span>Mục tiêu Listening</span>
                    <span>50%</span>
                  </div>
                  <div className="w-full bg-[#003366] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-white h-full" style={{ width: "50%" }}></div>
                  </div>
                </div>
              </div>
            </section>

          </div>

        </div>

      </main>
    </div>
  );
};

export default Profile;
