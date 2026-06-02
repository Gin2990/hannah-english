import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleStartPractice = (courseCode) => {
    if (courseCode === 'ielts') {
      navigate('/mock-tests');
    } else {
      navigate('/practice');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const query = searchQuery.toLowerCase();
    if (query.includes('toeic')) {
      handleStartPractice('toeic');
    } else if (query.includes('ielts')) {
      handleStartPractice('ielts');
    } else if (query.includes('admin') && user?.role === 'admin') {
      navigate('/admin');
    } else if (query.includes('teacher') && (user?.role === 'teacher' || user?.role === 'admin')) {
      navigate('/teacher');
    } else {
      handleStartPractice('student');
    }
  };

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] min-h-[calc(100vh-64px)] flex flex-col font-sans">
      
      {/* Dynamic Hero Section with Dotted Grid Pattern */}
      <section className="relative py-16 sm:py-24 px-6 md:px-12 bg-[#f8f9fa] overflow-hidden border-b border-slate-200" style={{
        backgroundImage: 'radial-gradient(#001e4011 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px'
      }}>
        <div className="max-w-[1440px] mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          
          {/* Left Column Text & Controls */}
          <div className="order-2 md:order-1 space-y-6">
            <span className="inline-block px-3 py-1 bg-[#d5e3ff] text-[#001b3c] rounded-full text-xs font-bold uppercase tracking-wider">
              Hannah English Precision
            </span>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[#001e40] leading-[1.15] tracking-tight">
              Chinh phục chứng chỉ Anh ngữ với Hannah English.
            </h1>
            <p className="text-[#5d5e5f] text-sm sm:text-base leading-relaxed max-w-lg">
              Nền tảng luyện thi chuẩn học thuật giúp bạn tối ưu hóa điểm số thông qua lộ trình cá nhân hóa và AI phân tích chuyên sâu.
            </p>
            
            {/* Search Input Box */}
            <form onSubmit={handleSearchSubmit} className="bg-white p-2 rounded-xl border border-[#c3c6d1] flex items-center gap-2 max-w-lg shadow-sm hover:border-[#001e40] transition-colors">
              <span className="material-symbols-outlined text-[#5d5e5f] px-2 text-xl font-bold">search</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bài thi (TOEIC, IELTS...)" 
                className="flex-grow border-none focus:ring-0 text-xs sm:text-sm text-[#191c1d] bg-transparent py-1.5 focus:outline-none"
              />
              <button type="submit" className="bg-[#001e40] hover:bg-[#003366] text-white px-5 sm:px-6 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm">
                Tìm
              </button>
            </form>

            {/* Popular tags */}
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="font-bold text-[#5d5e5f]">Phổ biến:</span>
              <span onClick={() => handleStartPractice('ielts')} className="px-3 py-1 bg-[#e1e3e4] rounded-full font-bold text-[#001e40] cursor-pointer hover:bg-[#c6c6c6] transition-colors">IELTS</span>
              <span onClick={() => handleStartPractice('toeic')} className="px-3 py-1 bg-[#e1e3e4] rounded-full font-bold text-[#001e40] cursor-pointer hover:bg-[#c6c6c6] transition-colors">TOEIC</span>
              <span onClick={() => handleStartPractice('student')} className="px-3 py-1 bg-[#e1e3e4] rounded-full font-bold text-[#001e40] cursor-pointer hover:bg-[#c6c6c6] transition-colors">KET/PET</span>
            </div>
          </div>

          {/* Right Column Image */}
          <div className="order-1 md:order-2">
            <img 
              alt="Hannah English Study Environment" 
              className="rounded-2xl shadow-xl w-full h-[320px] sm:h-[400px] object-cover border border-[#c3c6d1]" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCbhc1EkjGtblCPrBk6gC89Yx_u183TtxNooU_fe-eOpTAWqovwyQ3sHb55ocP3-m0Zoljg2B1TFK16i8ITjle14xlIvrZ6LuURdwQq3gyzZDGNJ1z3RKwqgBQCfbI5o28H9S0tpeqOPG4vG1y2r1hKMcgltGaIuywd2WNwE1__hF4hs8ob3RO_iwZ1-EH_IwdA6-Ffh8CKWsWymtKjXDdhCoFDP9K9muSECdrVxqXo8hY8ig96bPP6q41agw9bZJ9h1bOMWau89VPC"
            />
          </div>
        </div>
      </section>

      {/* Featured Programs Section */}
      <section className="py-16 sm:py-24 max-w-[1440px] mx-auto w-full px-6">
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[#001e40] mb-12 text-center tracking-tight">
          Chương trình Đào tạo Tiêu biểu
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* IELTS Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#c3c6d1] flex flex-col hover:border-[#001e40] hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 bg-[#d5e3ff] text-[#001b3c] rounded-full font-bold text-[10px] uppercase tracking-wider">Premium</span>
              <span className="material-symbols-outlined text-[#001e40] text-xl font-bold bg-[#f8f9fa] p-2 rounded-xl border border-slate-100">school</span>
            </div>
            <h3 className="font-display font-extrabold text-[#001e40] text-lg sm:text-xl mb-2">IELTS Simulation</h3>
            <p className="text-[#5d5e5f] text-xs sm:text-sm mb-6 flex-grow leading-relaxed">
              Mô phỏng 100% kỳ thi thực tế với hệ thống chấm đề và phân tích điểm số trực tuyến tức thì.
            </p>
            <div className="mb-6 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>Tiến độ học tập</span>
                <span className="font-extrabold text-[#001e40]">65%</span>
              </div>
              <div className="h-2 bg-[#f3f4f5] rounded-full overflow-hidden">
                <div className="h-full bg-[#001e40] rounded-full transition-all duration-1000" style={{ width: "65%" }}></div>
              </div>
            </div>
            <button 
              onClick={() => handleStartPractice('ielts')}
              className="w-full bg-[#001e40] hover:bg-[#003366] text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm active:scale-97"
            >
              Start Practice
            </button>
          </div>

          {/* TOEIC Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#c3c6d1] flex flex-col hover:border-[#001e40] hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 bg-[#e0dfdf] text-[#626363] rounded-full font-bold text-[10px] uppercase tracking-wider">Full Access</span>
              <span className="material-symbols-outlined text-[#001e40] text-xl font-bold bg-[#f8f9fa] p-2 rounded-xl border border-slate-100">assignment</span>
            </div>
            <h3 className="font-display font-extrabold text-[#001e40] text-lg sm:text-xl mb-2">TOEIC Reading</h3>
            <p className="text-[#5d5e5f] text-xs sm:text-sm mb-6 flex-grow leading-relaxed">
              Làm chủ kỹ năng đọc hiểu, ngữ pháp chuẩn ETS và chiến thuật quản lý thời gian thi thực tế.
            </p>
            <div className="mb-6 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>Tiến độ học tập</span>
                <span className="font-extrabold text-[#001e40]">20%</span>
              </div>
              <div className="h-2 bg-[#f3f4f5] rounded-full overflow-hidden">
                <div className="h-full bg-[#001e40] rounded-full transition-all duration-1000" style={{ width: "20%" }}></div>
              </div>
            </div>
            <button 
              onClick={() => handleStartPractice('toeic')}
              className="w-full bg-[#001e40] hover:bg-[#003366] text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm active:scale-97"
            >
              Start Practice
            </button>
          </div>

          {/* Cambridge Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#c3c6d1] flex flex-col hover:border-[#001e40] hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 bg-[#e0dfdf] text-[#626363] rounded-full font-bold text-[10px] uppercase tracking-wider">B1 Preliminary</span>
              <span className="material-symbols-outlined text-[#001e40] text-xl font-bold bg-[#f8f9fa] p-2 rounded-xl border border-slate-100">history_edu</span>
            </div>
            <h3 className="font-display font-extrabold text-[#001e40] text-lg sm:text-xl mb-2">KET/PET Prep</h3>
            <p className="text-[#5d5e5f] text-xs sm:text-sm mb-6 flex-grow leading-relaxed">
              Luyện tập nền tảng từ vựng, ngữ pháp vững chắc cho các chứng chỉ Cambridge chuẩn quốc tế.
            </p>
            <div className="mb-6 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>Tiến độ học tập</span>
                <span className="font-extrabold text-[#001e40]">0%</span>
              </div>
              <div className="h-2 bg-[#f3f4f5] rounded-full overflow-hidden">
                <div className="h-full bg-[#001e40] rounded-full transition-all duration-1000" style={{ width: "0%" }}></div>
              </div>
            </div>
            <button 
              onClick={() => handleStartPractice('student')}
              className="w-full bg-[#001e40] hover:bg-[#003366] text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm active:scale-97"
            >
              Start Practice
            </button>
          </div>

        </div>
      </section>

    </div>
  );
};

export default Home;
