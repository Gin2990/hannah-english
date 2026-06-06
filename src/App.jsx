import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Home from './pages/Home';
import Auth from './pages/Auth';
import StudentDashboard from './pages/StudentDashboard';
import Practice from './pages/Practice';
import MockTests from './pages/MockTests';
import PracticeIntro from './pages/PracticeIntro';
import ExamTaker from './pages/ExamTaker';
import Profile from './pages/Profile';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import IeltsConverter from './pages/IeltsConverter';

const AppContent = () => {
  const location = useLocation();
  const isExamTaker = location.pathname.startsWith('/exam-taker/');

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* Global Header - Hide in ExamTaker to enable native full screen testing */}
      {!isExamTaker && <Navbar />}
      
      {/* Main Routing Gateway */}
      <main className="flex-grow flex flex-col">
        <Routes>
          {/* Public Routes (Guests can browse) */}
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/mock-tests" element={<MockTests />} />

          {/* Guarded Student Portal */}
          <Route 
            path="/student" 
            element={
              <PrivateRoute allowedRoles={['student', 'admin']}>
                <StudentDashboard />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/practice-intro/:id" 
            element={
              <PrivateRoute allowedRoles={['student', 'admin']}>
                <PracticeIntro />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/exam-taker/:id" 
            element={
              <PrivateRoute allowedRoles={['student', 'teacher', 'admin']}>
                <ExamTaker />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/profile" 
            element={
              <PrivateRoute allowedRoles={['student', 'admin']}>
                <Profile />
              </PrivateRoute>
            } 
          />

          {/* Guarded Teacher Portal */}
          <Route 
            path="/teacher" 
            element={
              <PrivateRoute allowedRoles={['teacher', 'admin']}>
                <TeacherDashboard />
              </PrivateRoute>
            } 
          />

          <Route 
            path="/teacher/converter" 
            element={
              <PrivateRoute allowedRoles={['teacher', 'admin']}>
                <IeltsConverter />
              </PrivateRoute>
            } 
          />

          {/* Guarded Admin Portal */}
          <Route 
            path="/admin" 
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </PrivateRoute>
            } 
          />

          {/* Fallback to homepage */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Global Footer - Hide in ExamTaker */}
      {!isExamTaker && <Footer />}
    </div>
  );
};

function App() {
  // BỘ BẢO VỆ CHỐNG TỰ ĐỘNG REFRESH / MẤT DỮ LIỆU ĐỘNG KHI CHUYỂN TAB VÀ FOCUS
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Hệ thống đã chặn reload tự động để bảo vệ tiến trình soạn đề và làm bài của bạn. Bạn có thực sự muốn rời đi?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
