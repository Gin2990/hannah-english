import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

// Helper to convert Google Drive audio links to direct media links
const convertGoogleDriveAudioLink = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) {
    return `https://docs.google.com/uc?export=download&id=${fileDMatch[1]}`;
  }
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com'))) {
    return `https://docs.google.com/uc?export=download&id=${idMatch[1]}`;
  }
  return trimmed;
};

// Helper to isolate instructions from question text
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

// Helper to split options that got concatenated into a single block
const splitEmbeddedOptions = (text) => {
  if (!text) return [];
  const hasMultiple = /[\.\s\u00A0][B-D][\.\-\)\s\u00A0]/i.test(text) && 
                      /[\.\s\u00A0][C-E][\.\-\)\s\u00A0]/i.test(text);
  if (!hasMultiple) return [text];
  const parts = text.split(/(?=\b[B-K][\.\-\)\s\u00A0])/i);
  return parts.map(p => p.trim()).filter(Boolean);
};

const convertGoogleDrivePdfLink = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) {
    return `https://drive.google.com/file/d/${fileDMatch[1]}/preview`;
  }
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com'))) {
    return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }
  return trimmed;
};

const isOptionAnswer = (ans) => {
  if (!ans) return false;
  const clean = ans.trim().toUpperCase();
  if (/^[A-K]$/.test(clean)) return true;
  if (/^[A-K](\s*,\s*[A-K])+$/.test(clean)) return true;
  return false;
};

const parseListeningQuestions = (elements, keysMap, startQ, endQ) => {
  const questions = [];
  const items = elements.map((el, index) => ({
    el,
    text: el.textContent.trim(),
    html: el.outerHTML,
    index
  })).filter(item => item.text !== "");

  for (let qId = startQ; qId <= endQ; qId++) {
    const qRegex = new RegExp("(?:^|\\s|\\(|\\-|\\u00A0)" + qId + "(?:\\.|\\s|\\)|\\_|\\]|$)");
    let foundItem = null;
    for (let i = 0; i < items.length; i++) {
      if (qRegex.test(items[i].text)) {
        foundItem = items[i];
        break;
      }
    }

    let questionText = "";
    let options = [];
    const correct = keysMap[qId] || "";

    if (foundItem) {
      const isHeader = foundItem.text.match(/^questions?\s+\d+/i);
      
      if (isHeader) {
        let scanIdx = foundItem.index + 1;
        let foundQText = "";
        const collectedOpts = [];
        
        while (scanIdx < elements.length) {
          const el = elements[scanIdx];
          const text = el.textContent.trim();
          scanIdx++;
          if (!text) continue;
          
          if (text.match(/^questions?\s+\d+/i) || text.match(/^\d+[\.\-\)]/)) {
            break;
          }
          
          const optMatch = text.match(/^([A-K])[\.\-\)\s\u00A0]+\s*(.+)$/i);
          if (optMatch) {
            collectedOpts.push(text);
          } else {
            const isInstruction = text.match(/^choose\s+/i) || 
                                  text.match(/^complete\s+/i) || 
                                  text.match(/^write\s+/i) || 
                                  text.match(/^do the following/i) || 
                                  text.match(/^classify\s+/i) || 
                                  text.match(/^label\s+/i);
            if (!isInstruction && !foundQText) {
              foundQText = text;
            }
          }
        }
        
        questionText = foundQText || foundItem.text;
        options = collectedOpts;
      } else {
        questionText = foundItem.text;
        let scanIdx = foundItem.index - 1;
        const collectedOpts = [];
        let maxLookup = 15;
        
        while (scanIdx >= 0 && maxLookup > 0) {
          const el = elements[scanIdx];
          const text = el.textContent.trim();
          scanIdx--;
          maxLookup--;
          if (!text) continue;
          
          if ((text.match(/^\d+[\.\-\)]/) || text.match(/^questions?\s+\d+/i)) && !text.match(/^([A-K])[\.\-\)\s\u00A0]+/i)) {
            break;
          }
          
          const optMatch = text.match(/^([A-K])[\.\-\)\s\u00A0]+\s*(.*)$/i);
          if (optMatch) {
            collectedOpts.push(text);
            if (optMatch[1].toUpperCase() === 'A') {
              break;
            }
          }
        }
        
        if (collectedOpts.length > 0) {
          options = collectedOpts.reverse();
        }
      }
    } else {
      questionText = `Question ${qId}`;
    }

    let cleanQText = questionText.replace(new RegExp("^" + qId + "\\s*[\\.\\-\\)\\s]*\\s*"), "").trim();
    
    const cleanOptions = options.map(opt => {
      const match = opt.match(/^([A-K])[\.\-\)\s\u00A0]*\s*(.*)$/i);
      if (match) {
        return `${match[1].toUpperCase()}. ${match[2].trim()}`;
      }
      return opt;
    });

    const isOpt = isOptionAnswer(correct);
    
    questions.push({
      id: qId,
      question: cleanQText || `Question ${qId}`,
      options: isOpt ? cleanOptions : [],
      correct
    });
  }

  return questions;
};

const TeacherDashboard = () => {
  const { user } = useAuth();
  
  // General platform states
  const [courses, setCourses] = useState([]);
  const [publishedExams, setPublishedExams] = useState([]);
  const [studentAttempts, setStudentAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // States for Editing Exams
  const [editingExam, setEditingExam] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCourseId, setEditCourseId] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editType, setEditType] = useState('test');
  const [updatingExam, setUpdatingExam] = useState(false);

  // States for DOCX Conversion & Creation
  const [examTitle, setExamTitle] = useState('');
  const [examCourseId, setExamCourseId] = useState('');
  const [examDuration, setExamDuration] = useState(60);
  const [examType, setExamType] = useState('test'); // 'test' (Full Test) hoặc 'homework' (Practice)
  const [isListening, setIsListening] = useState(false);
  const [listeningAudio1, setListeningAudio1] = useState('');
  const [listeningAudio2, setListeningAudio2] = useState('');
  const [listeningAudio3, setListeningAudio3] = useState('');
  const [listeningAudio4, setListeningAudio4] = useState('');
  const [activePartIdx, setActivePartIdx] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewActive, setPreviewActive] = useState(false);

  // Word DOCX Files States
  const [docxTestFile, setDocxTestFile] = useState(null);
  const [docxKeyFile, setDocxKeyFile] = useState(null);
  const [convertingDocx, setConvertingDocx] = useState(false);
  const [convertedExam, setConvertedExam] = useState(null);

  // Tabs, Classes and Assignments States
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'editor', 'exams', 'classes', 'students'
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [mockMode, setMockMode] = useState(false);

  // Form states for class management
  const [newClassName, setNewClassName] = useState('');
  const [newClassCourseId, setNewClassCourseId] = useState('');
  const [assigningStudentId, setAssigningStudentId] = useState('');
  const [assigningClassId, setAssigningClassId] = useState('');
  const [assignHomeworkExamId, setAssignHomeworkExamId] = useState('');
  const [assignHomeworkTargetType, setAssignHomeworkTargetType] = useState('class'); // 'class' hoặc 'student'
  const [assignHomeworkClassId, setAssignHomeworkClassId] = useState('');
  const [assignHomeworkStudentId, setAssignHomeworkStudentId] = useState('');
  const [assignHomeworkDueDate, setAssignHomeworkDueDate] = useState('');
  const [submittingClass, setSubmittingClass] = useState(false);
  const [submittingStudentAssign, setSubmittingStudentAssign] = useState(false);
  const [submittingHomeworkAssign, setSubmittingHomeworkAssign] = useState(false);

  // Dữ liệu giả lập (Mock Data) khi chưa chạy SQL DB migration
  const mockClasses = [
    { id: 'mock-class-1', name: 'IELTS IELTS-101', course_id: '', student_count: 2, assignment_count: 1 },
    { id: 'mock-class-2', name: 'IELTS IELTS-102', course_id: '', student_count: 1, assignment_count: 0 },
    { id: 'mock-class-3', name: 'TOEIC TOEIC-500', course_id: '', student_count: 1, assignment_count: 0 }
  ];

  const mockStudentsList = [
    { id: 'mock-student-1', full_name: 'Nguyễn Văn A', email: 'a@hannah.edu.vn', class_id: 'mock-class-1', class_name: 'IELTS IELTS-101' },
    { id: 'mock-student-2', full_name: 'Trần Thị B', email: 'b@hannah.edu.vn', class_id: 'mock-class-1', class_name: 'IELTS IELTS-101' },
    { id: 'mock-student-3', full_name: 'Lê Hoàng C', email: 'c@hannah.edu.vn', class_id: 'mock-class-2', class_name: 'IELTS IELTS-102' },
    { id: 'mock-student-4', full_name: 'Phạm Minh D', email: 'd@hannah.edu.vn', class_id: 'mock-class-3', class_name: 'TOEIC TOEIC-500' }
  ];

  const mockAssignmentsList = [
    { id: 'mock-assign-1', exam_id: '', exam_title: 'IELTS Listening Test 01', class_id: 'mock-class-1', class_name: 'IELTS IELTS-101', student_id: null, student_name: null, due_date: '2026-06-15T23:59:59Z', created_at: '2026-06-06T10:00:00Z' },
    { id: 'mock-assign-2', exam_id: '', exam_title: 'IELTS Reading Test 1', class_id: null, class_name: null, student_id: 'mock-student-2', student_name: 'Trần Thị B', due_date: '2026-06-12T18:00:00Z', created_at: '2026-06-06T10:15:00Z' }
  ];

  const timerRef = useRef(null);

  useEffect(() => {
    const initData = async () => {
      await fetchCourses();
      await fetchPublishedExams();
      await fetchStudentAttempts();
      const dbConnected = await fetchClasses();
      if (dbConnected) {
        await fetchStudents();
        await fetchAssignments();
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (previewActive) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setElapsedSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [previewActive]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('title', { ascending: true });
      if (error) throw error;
      setCourses(data || []);
      if (data && data.length > 0) {
        const ieltsCourse = data.find(c => c.code === 'ielts');
        setExamCourseId(ieltsCourse ? ieltsCourse.id : data[0].id);
      }
    } catch (err) {
      console.error("Lỗi tải khóa học:", err);
    }
  };

  const fetchPublishedExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          *,
          courses (
            title,
            code
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPublishedExams(data || []);
    } catch (err) {
      console.error("Lỗi tải đề thi:", err);
    }
  };

  const fetchStudentAttempts = async () => {
    try {
      setLoadingAttempts(true);
      const { data, error } = await supabase
        .from('exam_results')
        .select(`
          id,
          score,
          total_questions,
          duration_seconds,
          taken_at,
          profiles (
            full_name,
            email
          ),
          exams (
            title
          )
        `)
        .order('taken_at', { ascending: false });

      if (error) throw error;
      setStudentAttempts(data || []);
    } catch (err) {
      console.error("Lỗi tải lịch sử thi học viên:", err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          courses (
            id,
            title
          )
        `)
        .order('name', { ascending: true });

      if (error) {
        console.error("Lỗi truy vấn lớp học (tự động chuyển sang Mock Mode):", error);
        setMockMode(true);
        setClasses(mockClasses);
        setStudents(mockStudentsList);
        setAssignments(mockAssignmentsList);
        return false;
      }
      setClasses(data || []);
      return true;
    } catch (err) {
      console.error("Lỗi hệ thống khi nạp lớp học (tự động chuyển sang Mock Mode):", err);
      setMockMode(true);
      setClasses(mockClasses);
      setStudents(mockStudentsList);
      setAssignments(mockAssignmentsList);
      return false;
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchStudents = async () => {
    if (mockMode) return;
    try {
      setLoadingStudents(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          class_id,
          classes!profiles_class_id_fkey (
            name
          )
        `)
        .eq('role', 'student')
        .order('full_name', { ascending: true });

      if (error) throw error;
      
      // Khớp cấu trúc để s.classes vẫn hợp lệ dù có modifier trong select
      const mappedData = (data || []).map(item => ({
        ...item,
        classes: item.classes || null
      }));
      
      setStudents(mappedData);
    } catch (err) {
      console.error("Lỗi tải học viên:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchAssignments = async () => {
    if (mockMode) return;
    try {
      setLoadingAssignments(true);
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          exams (
            title
          ),
          classes (
            name
          ),
          profiles:student_id (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (err) {
      console.error("Lỗi tải bài tập giao:", err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleCreateClass = async (e) => {
    if (e) e.preventDefault();
    if (!newClassName.trim()) {
      alert("⚠️ Vui lòng nhập tên lớp học!");
      return;
    }
    if (!newClassCourseId) {
      alert("⚠️ Vui lòng chọn khóa học tương ứng!");
      return;
    }

    const selectedCourse = courses.find(c => c.id === newClassCourseId);
    const courseTitle = selectedCourse ? selectedCourse.title : 'Course';

    if (mockMode) {
      const newClassItem = {
        id: `mock-class-${Date.now()}`,
        name: newClassName.trim(),
        course_id: newClassCourseId,
        courses: { title: courseTitle },
        student_count: 0,
        assignment_count: 0
      };
      setClasses(prev => [...prev, newClassItem]);
      setNewClassName('');
      showToast(`[MOCK MODE] Đã tạo lớp "${newClassName.trim()}" thành công!`);
      return;
    }

    try {
      setSubmittingClass(true);
      const { error } = await supabase
        .from('classes')
        .insert({
          name: newClassName.trim(),
          course_id: newClassCourseId,
          created_by: user?.id
        });

      if (error) throw error;
      showToast(`Đã tạo lớp "${newClassName.trim()}" thành công!`);
      setNewClassName('');
      fetchClasses();
    } catch (err) {
      alert("Lỗi khi tạo lớp học: " + err.message);
    } finally {
      setSubmittingClass(false);
    }
  };

  const handleAssignStudent = async (e) => {
    if (e) e.preventDefault();
    if (!assigningStudentId) {
      alert("⚠️ Vui lòng chọn học viên!");
      return;
    }

    const targetClass = classes.find(c => c.id === assigningClassId);
    const targetClassName = targetClass ? targetClass.name : 'Chưa xếp lớp';

    if (mockMode) {
      setStudents(prev => prev.map(s => {
        if (s.id === assigningStudentId) {
          return {
            ...s,
            class_id: assigningClassId || null,
            classes: assigningClassId ? { name: targetClassName } : null,
            class_name: assigningClassId ? targetClassName : null
          };
        }
        return s;
      }));
      setAssigningStudentId('');
      setAssigningClassId('');
      showToast(`[MOCK MODE] Đã phân lớp học viên thành công!`);
      return;
    }

    try {
      setSubmittingStudentAssign(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          class_id: assigningClassId || null
        })
        .eq('id', assigningStudentId);

      if (error) throw error;
      showToast("Đã phân lớp cho học viên thành công!");
      setAssigningStudentId('');
      setAssigningClassId('');
      fetchStudents();
      fetchClasses();
    } catch (err) {
      alert("Lỗi khi xếp lớp học viên: " + err.message);
    } finally {
      setSubmittingStudentAssign(false);
    }
  };

  const handleUpdateStudentClass = async (studentId, classId) => {
    const targetClass = classes.find(c => c.id === classId);
    const targetClassName = targetClass ? targetClass.name : 'Chưa xếp lớp';

    if (mockMode) {
      setStudents(prev => prev.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            class_id: classId || null,
            classes: classId ? { name: targetClassName } : null,
            class_name: classId ? targetClassName : null
          };
        }
        return s;
      }));
      showToast(`[MOCK MODE] Đã chuyển lớp cho học viên sang "${targetClassName}"!`);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          class_id: classId || null
        })
        .eq('id', studentId);

      if (error) throw error;
      showToast(`Đã xếp học viên vào lớp "${targetClassName}" thành công!`);
      fetchStudents();
      fetchClasses();
    } catch (err) {
      alert("Lỗi khi xếp lớp học viên: " + err.message);
    }
  };

  const handleAssignHomework = async (e, targetTypeOverride = null) => {
    if (e) e.preventDefault();
    if (!assignHomeworkExamId) {
      alert("⚠️ Vui lòng chọn bài tập/đề thi cần giao!");
      return;
    }
    const targetType = targetTypeOverride || assignHomeworkTargetType;
    if (targetType === 'class' && !assignHomeworkClassId) {
      alert("⚠️ Vui lòng chọn lớp học!");
      return;
    }
    if (targetType === 'student' && !assignHomeworkStudentId) {
      alert("⚠️ Vui lòng chọn học viên!");
      return;
    }

    const selectedExam = publishedExams.find(ex => ex.id === assignHomeworkExamId) || { title: 'Đề thi đã chọn' };
    const targetClass = classes.find(c => c.id === assignHomeworkClassId);
    const targetStudent = students.find(s => s.id === assignHomeworkStudentId);

    if (mockMode) {
      const newAssignItem = {
        id: `mock-assign-${Date.now()}`,
        exam_id: assignHomeworkExamId,
        exam_title: selectedExam.title,
        class_id: targetType === 'class' ? assignHomeworkClassId : null,
        class_name: targetType === 'class' ? targetClass?.name : null,
        student_id: targetType === 'student' ? assignHomeworkStudentId : null,
        student_name: targetType === 'student' ? targetStudent?.full_name : null,
        due_date: assignHomeworkDueDate ? new Date(assignHomeworkDueDate + 'T23:59:59').toISOString() : null,
        created_at: new Date().toISOString()
      };
      setAssignments(prev => [newAssignItem, ...prev]);
      
      if (targetType === 'class') {
        setClasses(prev => prev.map(c => c.id === assignHomeworkClassId ? { ...c, assignment_count: (c.assignment_count || 0) + 1 } : c));
      }

      setAssignHomeworkExamId('');
      setAssignHomeworkClassId('');
      setAssignHomeworkStudentId('');
      setAssignHomeworkDueDate('');
      showToast(`[MOCK MODE] Đã giao bài tập thành công!`);
      return;
    }

    try {
      setSubmittingHomeworkAssign(true);
      const payload = {
        exam_id: assignHomeworkExamId,
        class_id: targetType === 'class' ? assignHomeworkClassId : null,
        student_id: targetType === 'student' ? assignHomeworkStudentId : null,
        due_date: assignHomeworkDueDate ? new Date(assignHomeworkDueDate + 'T23:59:59').toISOString() : null,
        created_by: user?.id
      };

      const { error } = await supabase
        .from('assignments')
        .insert(payload);

      if (error) throw error;
      showToast("Giao bài tập/thi thử cho học viên thành công!");
      setAssignHomeworkExamId('');
      setAssignHomeworkClassId('');
      setAssignHomeworkStudentId('');
      setAssignHomeworkDueDate('');
      fetchAssignments();
    } catch (err) {
      alert("Lỗi khi giao bài tập: " + err.message);
    } finally {
      setSubmittingHomeworkAssign(false);
    }
  };

  const handleDeleteAssignment = async (assignId) => {
    if (!window.confirm("🗑️ Bạn có chắc muốn thu hồi bài tập này không?")) return;

    if (mockMode) {
      const targetAssign = assignments.find(a => a.id === assignId);
      if (targetAssign && targetAssign.class_id) {
        setClasses(prev => prev.map(c => c.id === targetAssign.class_id ? { ...c, assignment_count: Math.max(0, (c.assignment_count || 0) - 1) } : c));
      }
      setAssignments(prev => prev.filter(a => a.id !== assignId));
      showToast(`[MOCK MODE] Đã thu hồi bài tập thành công!`);
      return;
    }

    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignId);

      if (error) throw error;
      showToast("Đã thu hồi bài tập thành công!");
      fetchAssignments();
    } catch (err) {
      alert("Lỗi khi thu hồi bài tập: " + err.message);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm("🔥 CẢNH BÁO: Hành động này sẽ XÓA VĨNH VIỄN đề thi này cùng mọi lịch sử kết quả của học sinh liên quan! Bạn có chắc chắn muốn tiếp tục?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (error) throw error;
      showToast("Đã xóa vĩnh viễn đề thi thành công!");
      fetchPublishedExams();
      fetchStudentAttempts();
    } catch (err) {
      alert("Lỗi xóa đề: " + err.message);
    }
  };

  const handleStartEdit = (exam) => {
    setEditingExam(exam);
    setEditTitle(exam.title || '');
    setEditCourseId(exam.course_id || '');
    setEditDuration(exam.duration || 60);
    setEditType(exam.type || 'test');
  };

  const handleUpdateExam = async (e) => {
    if (e) e.preventDefault();
    if (!editingExam) return;
    if (!editTitle.trim()) {
      alert("⚠️ Vui lòng nhập tiêu đề bài thi!");
      return;
    }

    try {
      setUpdatingExam(true);
      const { error } = await supabase
        .from('exams')
        .update({
          title: editTitle.trim(),
          course_id: editCourseId,
          duration: parseInt(editDuration) || 0,
          type: editType
        })
        .eq('id', editingExam.id);

      if (error) throw error;
      
      showToast(`Đã cập nhật đề thi "${editTitle.trim()}" thành công!`);
      setEditingExam(null);
      fetchPublishedExams();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi cập nhật đề thi: " + err.message);
    } finally {
      setUpdatingExam(false);
    }
  };

  const loadMammoth = () => {
    return new Promise((resolve, reject) => {
      if (window.mammoth) {
        resolve(window.mammoth);
        return;
      }
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js";
      script.onload = () => resolve(window.mammoth);
      script.onerror = (err) => reject(new Error("Không thể tải thư viện giải nén file Word (mammoth.js)."));
      document.head.appendChild(script);
    });
  };

  const parseAnswersKeyText = (text) => {
    const keysMap = {};
    if (!text) return keysMap;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    lines.forEach(line => {
      // Handle joint answers like "17&18. B, E" or "17 and 18. B, E" or "17,18. B, E"
      const jointMatch = line.match(/^(\d+)\s*(?:&|and|,)\s*(\d+)\s*[\.\-\:\)\]\/]?\s*(.+)$/i);
      if (jointMatch) {
        const qNum1 = parseInt(jointMatch[1]);
        const qNum2 = parseInt(jointMatch[2]);
        const ansText = jointMatch[3].trim();
        const answers = ansText.split(/[\s,;/]+/).map(a => a.trim()).filter(Boolean);
        if (answers.length >= 2) {
          keysMap[qNum1] = answers[0];
          keysMap[qNum2] = answers[1];
        } else if (answers.length === 1) {
          keysMap[qNum1] = answers[0];
          keysMap[qNum2] = answers[0];
        }
        return;
      }

      const singleMatch = line.match(/^(\d+)\s*[\.\-\:\)\]\/]?\s*(.+)$/i);
      if (singleMatch) {
        const qNum = parseInt(singleMatch[1]);
        const ans = singleMatch[2].trim();
        if (qNum >= 1 && qNum <= 45) {
          keysMap[qNum] = ans;
          return;
        }
      }

      let lineMatch;
      const lineRegex = /(\d+)\s*[\.\-\:\)\]\/]?\s*(.+?)(?=\s+\d+[\.\-\:\)\]\/]?\s+|\s*$)/gi;
      while ((lineMatch = lineRegex.exec(line)) !== null) {
        const qNum = parseInt(lineMatch[1]);
        const ans = lineMatch[2].trim();
        if (qNum >= 1 && qNum <= 45 && ans) {
          keysMap[qNum] = ans;
        }
      }
    });

    if (Object.keys(keysMap).length < 5) {
      let pendingNum = null;
      lines.forEach(line => {
        const parts = line.split(/\t|\s{2,}|\|/).map(p => p.trim()).filter(Boolean);
        parts.forEach(part => {
          const pairMatch = part.match(/^(\d+)\s*[\.\-\:\)\]\/]?\s*(.+)$/i);
          if (pairMatch) {
            const qNum = parseInt(pairMatch[1]);
            const ans = pairMatch[2].trim();
            if (ans && qNum >= 1 && qNum <= 45) {
              keysMap[qNum] = ans;
              pendingNum = null;
            }
          } else {
            const numMatch = part.match(/^(\d+)$/);
            if (numMatch) {
              const qNum = parseInt(numMatch[1]);
              if (qNum >= 1 && qNum <= 45) {
                pendingNum = qNum;
              }
            } else if (pendingNum !== null) {
              keysMap[pendingNum] = part;
              pendingNum = null;
            }
          }
        });
      });
    }

    return keysMap;
  };

  const extractPassageTitle = (elements, partNum) => {
    for (let i = 0; i < Math.min(elements.length, 5); i++) {
      const text = elements[i].textContent.trim();
      if (!text) continue;
      if (text.match(/READING\s+PASSAGE/i)) continue;
      if (text.match(/You should spend/i)) continue;
      return text;
    }
    return `Reading Passage ${partNum}`;
  };

  const parsePassageQuestions = (elements, keysMap) => {
    const questions = [];
    let currentQuestion = null;
    const sharedOptions = [];
    let pendingInstruction = "";

    elements.forEach(el => {
      const originalText = el.textContent.trim();
      if (!originalText) return;

      const texts = splitEmbeddedOptions(originalText);
      const isSharedOptionsBlock = texts.length > 5 || texts.some(t => t.match(/^[F-K][\.\-\)\s\u00A0]/i));

      texts.forEach(text => {
        const isInstructionText = text.match(/^questions?\s+\d+/i) || 
                                  text.match(/^choose\s+/i) || 
                                  text.match(/^complete\s+/i) || 
                                  text.match(/^write\s+/i) || 
                                  text.match(/^do the following/i) || 
                                  text.match(/^classify\s+/i) || 
                                  text.match(/^label\s+/i) || 
                                  text.match(/^read\s+/i) ||
                                  text.match(/^look at the/i);

        if (isInstructionText) {
          if (currentQuestion) {
            questions.push(currentQuestion);
            currentQuestion = null;
          }
          if (pendingInstruction) {
            pendingInstruction += "\n" + text;
          } else {
            pendingInstruction = text;
          }
          return;
        }

        const qMatch = text.match(/^(\d+)[\.\-\s\)\/]*\s*(.+)$/i);
        if (qMatch && parseInt(qMatch[1]) <= 40) {
          if (currentQuestion) {
            questions.push(currentQuestion);
          }
          const qNum = parseInt(qMatch[1]);
          const cleanQuestionText = qMatch[2].trim();
          
          currentQuestion = {
            id: qNum,
            question: cleanQuestionText,
            instruction: pendingInstruction || "",
            options: [],
            correct: keysMap[qNum] || ""
          };
          pendingInstruction = "";
        } else if (currentQuestion) {
          const optMatch = text.match(/^([A-E])[\.\-\)\s\u00A0]+\s*(.+)$/i);
          const bulletMatch = text.match(/^[\u2022\u00b7\u2013\u2014\-\*]\s*(.+)$/);
          
          if (optMatch && !text.match(/^ANSWER\s*:/i)) {
            const letter = optMatch[1].toUpperCase();
            const optText = optMatch[2].trim();
            if (isSharedOptionsBlock) {
              sharedOptions.push(`${letter}. ${optText}`);
            } else {
              currentQuestion.options.push(`${letter}. ${optText}`);
            }
          } else if (el.tagName?.toLowerCase() === 'li' || bulletMatch) {
            const cleanText = bulletMatch ? bulletMatch[1].trim() : text;
            const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
            const nextLetter = optionLetters[currentQuestion.options.length] || 'A';
            if (isSharedOptionsBlock) {
              sharedOptions.push(`${nextLetter}. ${cleanText}`);
            } else {
              currentQuestion.options.push(`${nextLetter}. ${cleanText}`);
            }
          } else {
            const sharedOptMatch = text.match(/^([A-K])[\.\-\)\s\u00A0]+\s*(.+)$/i);
            if (sharedOptMatch) {
              const letter = sharedOptMatch[1].toUpperCase();
              const optText = sharedOptMatch[2].trim();
              sharedOptions.push(`${letter}. ${optText}`);
            } else {
              if (currentQuestion.options.length === 0) {
                currentQuestion.question += " " + text;
              } else {
                currentQuestion.options[currentQuestion.options.length - 1] += " " + text;
              }
            }
          }
        } else {
          const sharedOptMatch = text.match(/^([A-K])[\.\-\)\s\u00A0]+\s*(.+)$/i);
          if (sharedOptMatch) {
            const letter = sharedOptMatch[1].toUpperCase();
            const optText = sharedOptMatch[2].trim();
            sharedOptions.push(`${letter}. ${optText}`);
          }
        }
      });
    });

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    if (questions.length > 0 && sharedOptions.length > 0) {
      const lastQ = questions[questions.length - 1];
      if (lastQ.options && lastQ.options.length > 0) {
        const lastSpecificOpt = lastQ.options[lastQ.options.length - 1].trim();
        const firstSharedOpt = sharedOptions[0].trim();
        const lastSpecificMatch = lastSpecificOpt.match(/^([A-K])[\.\-\)\s\u00A0]/i);
        const firstSharedMatch = firstSharedOpt.match(/^([A-K])[\.\-\)\s\u00A0]/i);
        
        if (lastSpecificMatch && firstSharedMatch) {
          const lastChar = lastSpecificMatch[1].toUpperCase();
          const firstChar = firstSharedMatch[1].toUpperCase();
          const lastCode = lastChar.charCodeAt(0);
          const firstCode = firstChar.charCodeAt(0);
          if (firstCode === lastCode + 1) {
            sharedOptions.unshift(...lastQ.options);
            lastQ.options = [];
          }
        }
      }
    }

    if (sharedOptions.length > 0) {
      questions.forEach(q => {
        if (q.options.length === 0) {
          q.options = [...sharedOptions];
        }
      });
    }

    questions.forEach(q => {
      if (!q.correct) return;
      const cleanCorrect = q.correct.toUpperCase().trim();
      if (cleanCorrect.includes("YES") || cleanCorrect.includes("NO")) {
        q.options = ["YES", "NO", "NOT GIVEN"];
      } else if (cleanCorrect.includes("TRUE") || cleanCorrect.includes("FALSE")) {
        q.options = ["TRUE", "FALSE", "NOT GIVEN"];
      } else if (cleanCorrect === "NOT GIVEN" || cleanCorrect === "NOTGIVEN") {
        q.options = ["YES", "NO", "NOT GIVEN"];
      }
    });

    return questions;
  };

  const handleDocxConvert = async () => {
    if (!docxTestFile) {
      alert("⚠️ Vui lòng tải lên file đề thi Word (.docx)!");
      return;
    }
    if (!docxKeyFile) {
      alert("⚠️ Vui lòng tải lên file đáp án Word (.docx)!");
      return;
    }

    try {
      setConvertingDocx(true);
      const mammothInstance = await loadMammoth();

      // 1. Read key file answers
      const keyBuffer = await docxKeyFile.arrayBuffer();
      const keyTextResult = await mammothInstance.extractRawText({ arrayBuffer: keyBuffer });
      const keysMap = parseAnswersKeyText(keyTextResult.value);

      if (Object.keys(keysMap).length === 0) {
        throw new Error("Không thể trích xuất đáp án nào từ file key. Vui lòng kiểm tra lại định dạng!");
      }

      // 2. Read test file passages and questions
      const testBuffer = await docxTestFile.arrayBuffer();
      const testHtmlResult = await mammothInstance.convertToHtml({ arrayBuffer: testBuffer });
      const testHtml = testHtmlResult.value;

      // 3. Parse HTML elements
      const parser = new DOMParser();
      const doc = parser.parseFromString(testHtml, 'text/html');
      const bodyElements = Array.from(doc.body.children);

      const isListeningTest = isListening;
      const totalSectionsCount = isListeningTest ? 4 : 3;
      const passageElements = isListeningTest ? [[], [], [], []] : [[], [], []];
      let currentPassageIdx = 0;

      bodyElements.forEach(el => {
        const text = el.textContent.trim();
        if (isListeningTest) {
          if (text.match(/SECTION\s+1/i) || text.match(/PART\s+1/i) || text.match(/LISTENING\s+SECTION\s+1/i) || text.match(/LISTENING\s+PART\s+1/i)) {
            currentPassageIdx = 1;
          } else if (text.match(/SECTION\s+2/i) || text.match(/PART\s+2/i) || text.match(/LISTENING\s+SECTION\s+2/i) || text.match(/LISTENING\s+PART\s+2/i)) {
            currentPassageIdx = 2;
          } else if (text.match(/SECTION\s+3/i) || text.match(/PART\s+3/i) || text.match(/LISTENING\s+SECTION\s+3/i) || text.match(/LISTENING\s+PART\s+3/i)) {
            currentPassageIdx = 3;
          } else if (text.match(/SECTION\s+4/i) || text.match(/PART\s+4/i) || text.match(/LISTENING\s+SECTION\s+4/i) || text.match(/LISTENING\s+PART\s+4/i)) {
            currentPassageIdx = 4;
          }
        } else {
          if (text.match(/READING\s+PASSAGE\s+1/i) || text.match(/PASSAGE\s+1/i)) {
            currentPassageIdx = 1;
          } else if (text.match(/READING\s+PASSAGE\s+2/i) || text.match(/PASSAGE\s+2/i)) {
            currentPassageIdx = 2;
          } else if (text.match(/READING\s+PASSAGE\s+3/i) || text.match(/PASSAGE\s+3/i)) {
            currentPassageIdx = 3;
          }
        }

        if (currentPassageIdx > 0 && currentPassageIdx <= totalSectionsCount) {
          passageElements[currentPassageIdx - 1].push(el);
        }
      });

      // Validate passages split
      if (passageElements[0].length === 0 && passageElements[1].length === 0 && passageElements[2].length === 0 && (!isListeningTest || passageElements[3].length === 0)) {
        throw new Error(isListeningTest
          ? "Không tìm thấy các thẻ 'SECTION 1/2/3/4' để tách phần! Vui lòng kiểm tra tiêu đề các phần nghe trong file."
          : "Không tìm thấy các thẻ 'READING PASSAGE 1/2/3' để tách phần! Vui lòng kiểm tra tiêu đề các đoạn văn."
        );
      }

      const generatedParts = [];

      for (let pIdx = 0; pIdx < totalSectionsCount; pIdx++) {
        const elements = passageElements[pIdx];
        if (elements.length === 0) continue;

        const partNum = pIdx + 1;

        // Find the boundary between passage text and questions list
        let questionsStartIdx = -1;
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const text = el.textContent.trim();
          if (text.match(/^Questions?\s+\d+-\d+/i) || text.match(/^Questions?\s+\d+/i)) {
            questionsStartIdx = i;
            break;
          }
        }

        let passageContentHtml = "";
        let questionsList = [];

        const title = isListeningTest
          ? (partNum === 1 ? 'Section 1: Conversation' : (partNum === 2 ? 'Section 2: Social Monologue' : (partNum === 3 ? 'Section 3: Academic Talk' : 'Section 4: Academic Lecture')))
          : extractPassageTitle(elements, partNum);

        if (isListeningTest) {
          passageContentHtml = `<h2>${title}</h2>\n`;
          passageContentHtml += `<p>You should spend about 10 minutes on <strong>Questions ${partNum === 1 ? '1-10' : (partNum === 2 ? '11-20' : (partNum === 3 ? '21-30' : '31-40'))}</strong>.</p>\n\n`;
          
          elements.forEach(el => {
            const text = el.textContent.trim();
            if (text.match(/SECTION\s+\d/i) || text.match(/PART\s+\d/i) || text.match(/IELTS LISTENING TEST/i)) return;
            passageContentHtml += el.outerHTML + "\n";
          });

          const startQ = partNum === 1 ? 1 : (partNum === 2 ? 11 : (partNum === 3 ? 21 : 31));
          const endQ = partNum === 1 ? 10 : (partNum === 2 ? 20 : (partNum === 3 ? 30 : 40));
          questionsList = parseListeningQuestions(elements, keysMap, startQ, endQ);
        } else {
          if (questionsStartIdx !== -1) {
            const textElements = elements.slice(0, questionsStartIdx);
            const qElements = elements.slice(questionsStartIdx);

            passageContentHtml = `<h2>READING PASSAGE ${partNum}</h2>\n`;
            passageContentHtml += `<p>You should spend about 20 minutes on <strong>Questions ${partNum === 1 ? '1-13' : (partNum === 2 ? '14-27' : '28-40')}</strong> which are based on READING PASSAGE ${partNum} below.</p>\n\n`;
            passageContentHtml += `<div class="highlight-box" style="text-align: center; background-color: #f8fafc; border-left: 4px solid #001e40; padding: 1rem; margin: 1.5rem 0; border-radius: 0 0.75rem 0.75rem 0;">\n  <h3 style="margin-top: 0; font-size: 1.125rem; font-weight: 800; color: #001e40; text-transform: uppercase;">${title}</h3>\n</div>\n\n`;

            let titleFound = false;
            textElements.forEach(el => {
              const text = el.textContent.trim();
              if (text.match(/READING PASSAGE/i) || text.match(/SECTION\s+\d/i) || text.match(/PART\s+\d/i)) return;
              if (text.match(/You should spend/i)) return;
              if (text === title && !titleFound) {
                titleFound = true;
                return;
              }
              passageContentHtml += el.outerHTML + "\n";
            });

            const flattenHtmlElements = (nodes) => {
              const result = [];
              const traverse = (n) => {
                if (!n) return;
                const tagName = n.tagName?.toLowerCase();
                if (['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                  result.push(n);
                  return;
                }
                if (n.children && n.children.length > 0) {
                  Array.from(n.children).forEach(child => traverse(child));
                }
              };
              nodes.forEach(node => traverse(node));
              return result;
            };

            const flatQElements = flattenHtmlElements(qElements);
            questionsList = parsePassageQuestions(flatQElements, keysMap);
          } else {
            passageContentHtml = elements.map(el => el.outerHTML).join("\n");
          }
        }

        const audioUrlMapping = [listeningAudio1, listeningAudio2, listeningAudio3, listeningAudio4];

        generatedParts.push({
          part_code: isListeningTest ? `ielts_listening_part${partNum}` : `ielts_reading_passage${partNum}`,
          part_name: isListeningTest 
            ? (partNum === 1 ? 'Section 1' : (partNum === 2 ? 'Section 2' : (partNum === 3 ? 'Section 3' : 'Section 4')))
            : `Reading Passage ${partNum}`,
          part_title: title,
          part_content: passageContentHtml,
          audio_url: isListeningTest ? audioUrlMapping[partNum - 1] : null,
          questions: questionsList
        });
      }

      const totalQCount = generatedParts.reduce((acc, curr) => acc + curr.questions.length, 0);
      const guessedTitle = docxTestFile.name.replace(/\.[^/.]+$/, "").replace(/_test/i, "").replace(/_/g, ' ');
      const finalTitle = examTitle.trim() ? examTitle.trim() : guessedTitle;
      
      setExamTitle(finalTitle);
      setConvertedExam({
        title: finalTitle,
        course_id: examCourseId,
        duration: isListeningTest ? 40 : parseInt(examDuration) || 60,
        type: examType,
        question_count: totalQCount,
        test_parts: generatedParts,
        questions: []
      });

      showToast(`Chuyển đổi thành công! Phân tích được ${generatedParts.length} Phần với ${totalQCount} Câu hỏi.`);
      setPreviewActive(true);
      setActivePartIdx(0);
      setStudentAnswers({});
    } catch (err) {
      console.error(err);
      alert(`⚠️ Lỗi trích xuất và phân tích Word: ${err.message}`);
    } finally {
      setConvertingDocx(false);
    }
  };

  const selectPreviewAnswer = (qId, answer) => {
    setStudentAnswers(prev => ({
      ...prev,
      [qId]: answer
    }));
  };

  const handlePreviewMapClick = (partIndex, qId) => {
    setActivePartIdx(partIndex);
    setTimeout(() => {
      const card = document.getElementById(`preview-q-card-${qId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('border-indigo-600', 'ring-2', 'ring-indigo-100', 'shadow-md');
        setTimeout(() => {
          card.classList.remove('border-indigo-600', 'ring-2', 'ring-indigo-100', 'shadow-md');
        }, 1500);
      }
    }, 120);
  };

  const handlePreviewSubmit = () => {
    if (!convertedExam) return;
    let allQuestions = [];
    convertedExam.test_parts.forEach(p => {
      allQuestions = [...allQuestions, ...p.questions];
    });

    let score = 0;
    allQuestions.forEach(q => {
      if (matchIeltsAnswer(studentAnswers[q.id], q.correct)) score++;
    });

    alert(`🏆 [XEM TRƯỚC] Giả lập kết quả làm bài:\n👉 Đúng: ${score}/${allQuestions.length} câu\n👉 Độ chính xác: ${Math.round((score / allQuestions.length) * 100)}%\n👉 Thời gian làm bài: ${Math.floor(elapsedSeconds / 60)} phút`);
  };

  const publishToSupabase = async (e) => {
    if (e) e.preventDefault();
    if (!convertedExam) return;
    if (!examTitle.trim()) {
      alert('⚠️ Vui lòng điền tiêu đề bài thi!');
      return;
    }
    if (!examCourseId) {
      alert('⚠️ Vui lòng chọn khóa học target!');
      return;
    }

    try {
      setPublishing(true);

      const payload = {
        title: examTitle.trim(),
        course_id: examCourseId,
        duration: parseInt(examDuration),
        type: examType,
        question_count: convertedExam.question_count,
        test_parts: convertedExam.test_parts.map(p => ({
          part_code: p.part_code,
          part_name: p.part_name,
          audio_url: p.audio_url ? convertGoogleDriveAudioLink(p.audio_url) : null,
          part_content: p.part_content || null,
          questions: p.questions
        })),
        questions: [],
        created_by: user?.id || null
      };

      const { data, error } = await supabase
        .from('exams')
        .insert(payload)
        .select();

      if (error) throw error;

      showToast(`Đã xuất bản đề thi "${examTitle.trim()}" thành công trực tuyến lên Supabase!`);
      
      // Reset form chung
      setExamTitle('');
      setConvertedExam(null);
      setPreviewActive(false);
      setDocxTestFile(null);
      setDocxKeyFile(null);
      setIsListening(false);
      setListeningAudio1('');
      setListeningAudio2('');
      setListeningAudio3('');
      setListeningAudio4('');
      fetchPublishedExams();
      fetchStudentAttempts();
    } catch (err) {
      console.error(err);
      alert("Lỗi xuất bản đề thi: " + err.message);
    } finally {
      setPublishing(false);
    }
  };

  const formatStopwatch = () => {
    const min = Math.floor(elapsedSeconds / 60);
    const sec = elapsedSeconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const activePart = convertedExam?.test_parts[activePartIdx];
  const activeQuestions = activePart?.questions || [];
  const uniqueStudentsCount = new Set(studentAttempts.map(a => a.profiles?.email).filter(Boolean)).size;

  return (
    <div className="bg-[#f8f9fa] min-h-screen text-slate-800 pb-20 selection:bg-indigo-900 selection:text-white">
      {/* Dynamic inline styles for premium Study4 Mock Exam Room previewer */}
      <style dangerouslySetInnerHTML={{ __html: `
        .study4-passage {
          font-family: 'Inter', system-ui, sans-serif;
          color: #334155;
          font-size: 0.85rem;
          line-height: 1.75;
        }
        .study4-passage h2 {
          font-size: 1.15rem;
          font-weight: 800;
          color: #001e40;
          margin-bottom: 0.75rem;
          text-transform: uppercase;
        }
        .study4-passage h3 {
          font-size: 1rem;
          font-weight: 800;
          color: #001e40;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 4px;
        }
        .study4-passage p {
          margin-bottom: 0.75rem;
          text-align: justify;
        }
        .study4-passage table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.25rem 0;
          font-size: 0.8rem;
        }
        .study4-passage th, .study4-passage td {
          border: 1px solid #cbd5e1;
          padding: 8px 12px;
          text-align: left;
        }
        .study4-passage th {
          background-color: #f8fafc;
          color: #001e40;
          font-weight: 700;
        }
        .study4-passage tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .study4-passage .highlight-box {
          background-color: #f8fafc;
          border-left: 4px solid #001e40;
          padding: 1rem;
          margin: 1.25rem 0;
          border-radius: 0 0.75rem 0.75rem 0;
        }
        .custom-preview-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-preview-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .custom-preview-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 8px;
        }
        .custom-preview-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
          border-radius: 8px;
        }
        .highlighted-text {
          background-color: rgba(254, 240, 138, 0.6);
          border-radius: 3px;
          padding: 1px 3px;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
      
      {/* Banner */}
      <section className="bg-[#001e40] text-white py-10 px-6 relative overflow-hidden">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 z-10 relative">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs font-bold text-blue-300 uppercase tracking-widest">
              Teacher Dashboard
            </span>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Cổng Quản Trị Giảng Viên</h1>
            <p className="text-slate-400 text-xs">Biên soạn, kiểm tra và xuất bản đề thi trực tuyến tự động từ file Word (.docx) sang Supabase.</p>
          </div>
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white">GV</div>
            <div>
              <p className="text-xs font-bold">{user?.full_name}</p>
              <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Hannah English Mentor</span>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 mt-8 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6 mb-6 select-none shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'overview' ? 'text-blue-700 border-blue-700 font-extrabold' : 'text-slate-500 border-transparent hover:text-blue-700'}`}
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            Tổng Quan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'editor' ? 'text-blue-700 border-blue-700 font-extrabold' : 'text-slate-500 border-transparent hover:text-blue-700'}`}
          >
            <span className="material-symbols-outlined text-base">edit_document</span>
            Biên Soạn Đề Thi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'exams' ? 'text-blue-700 border-blue-700 font-extrabold' : 'text-slate-500 border-transparent hover:text-blue-700'}`}
          >
            <span className="material-symbols-outlined text-base">database</span>
            Kho Đề & Kết Quả
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'classes' ? 'text-blue-700 border-blue-700 font-extrabold' : 'text-slate-500 border-transparent hover:text-blue-700'}`}
          >
            <span className="material-symbols-outlined text-base">domain</span>
            Quản Lý Lớp Học
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'students' ? 'text-blue-700 border-blue-700 font-extrabold' : 'text-slate-500 border-transparent hover:text-blue-700'}`}
          >
            <span className="material-symbols-outlined text-base">group</span>
            Quản Lý Học Viên
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in font-semibold">
            {/* Stats Cards */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Học Viên Trực Tuyến</p>
                  <h3 className="text-2xl font-extrabold text-[#001e40] mt-1">{uniqueStudentsCount} học viên</h3>
                </div>
                <span className="material-symbols-outlined text-blue-600 bg-blue-50 p-3 rounded-2xl text-2xl font-bold">group</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Lớp Học Hoạt Động</p>
                  <h3 className="text-2xl font-extrabold text-[#001e40] mt-1">{classes.length} lớp</h3>
                </div>
                <span className="material-symbols-outlined text-emerald-600 bg-emerald-50 p-3 rounded-2xl text-2xl font-bold">domain</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Tổng Đề & Bài Giảng</p>
                  <h3 className="text-2xl font-extrabold text-[#001e40] mt-1">{publishedExams.length} bài đăng</h3>
                </div>
                <span className="material-symbols-outlined text-purple-600 bg-purple-50 p-3 rounded-2xl text-2xl font-bold">menu_book</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Lượt Làm Bài Hệ Thống</p>
                  <h3 className="text-2xl font-extrabold text-[#001e40] mt-1">{studentAttempts.length} lượt nộp</h3>
                </div>
                <span className="material-symbols-outlined text-indigo-600 bg-indigo-50 p-3 rounded-2xl text-2xl font-bold">assignment_turned_in</span>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bảng kiểm soát lớp học */}
              <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#001e40]">Kiểm Soát Học Viên Từng Lớp</h3>
                    <p className="text-slate-400 text-[9px]">Số lượng học viên và bài tập được phân phối theo lớp học.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('classes')}
                    className="text-[10px] font-bold text-blue-700 hover:underline flex items-center gap-1 bg-transparent border-0"
                  >
                    <span>Quản lý</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[9px] font-extrabold uppercase tracking-wider sticky top-0 z-10">
                        <th className="py-3 px-5">Tên lớp học</th>
                        <th className="py-3 px-5">Số học viên</th>
                        <th className="py-3 px-5">Bài tập đã giao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {classes.map(cls => {
                        const studentCount = mockMode 
                          ? (cls.student_count || 0)
                          : students.filter(s => s.class_id === cls.id).length;
                        
                        const assignCount = mockMode
                          ? (cls.assignment_count || 0)
                          : assignments.filter(a => a.class_id === cls.id).length;

                        return (
                          <tr key={cls.id} className="hover:bg-slate-50/30 transition-all">
                            <td className="py-3 px-5 font-bold text-[#001e40]">{cls.name}</td>
                            <td className="py-3 px-5">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-750 rounded-full font-bold text-[9px]">
                                {studentCount} học viên
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-750 rounded-full font-bold text-[9px]">
                                {assignCount} bài giao
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {classes.length === 0 && (
                        <tr>
                          <td colSpan="3" className="py-8 text-center text-slate-400 italic">
                            Chưa có lớp học nào được tạo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Thống kê bài giảng đã đăng */}
              <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#001e40]">Phân Loại Bài Giảng & Đề Thi</h3>
                    <p className="text-slate-400 text-[9px]">Thống kê chi tiết các đề thi và bài tập ôn luyện theo khóa học.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('exams')}
                    className="text-[10px] font-bold text-blue-700 hover:underline flex items-center gap-1 bg-transparent border-0"
                  >
                    <span>Xem kho đề</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[9px] font-extrabold uppercase tracking-wider sticky top-0 z-10">
                        <th className="py-3 px-5">Khóa học</th>
                        <th className="py-3 px-5">Luyện tập (Practice)</th>
                        <th className="py-3 px-5">Thi thử (Full Test)</th>
                        <th className="py-3 px-5">Tổng số đề</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {courses.map(course => {
                        const courseExams = publishedExams.filter(e => e.course_id === course.id);
                        const practiceCount = courseExams.filter(e => e.type === 'homework').length;
                        const testCount = courseExams.filter(e => e.type === 'test').length;
                        return (
                          <tr key={course.id} className="hover:bg-slate-50/30 transition-all">
                            <td className="py-3 px-5 font-bold text-[#001e40]">{course.title}</td>
                            <td className="py-3 px-5 text-emerald-600 font-bold">{practiceCount} bài tập</td>
                            <td className="py-3 px-5 text-rose-600 font-bold">{testCount} đề thi</td>
                            <td className="py-3 px-5">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold text-[9px]">
                                {courseExams.length} bài đăng
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {courses.length === 0 && (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-slate-400 italic">
                            Chưa có khóa học nào được đăng ký.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            
            {/* Lượt nộp bài gần đây */}
            <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-150 bg-slate-50/50">
                <h3 className="font-display text-sm font-bold text-[#001e40]">Lượt Nộp Bài Mới Nhất</h3>
                <p className="text-slate-400 text-[9px]">Theo dõi điểm số và thời gian làm bài mới nộp của học viên.</p>
              </div>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[9px] font-extrabold uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-3 px-5">Học viên</th>
                      <th className="py-3 px-5">Tên bài thi / bài tập</th>
                      <th className="py-3 px-5">Kết quả</th>
                      <th className="py-3 px-5">Thời gian nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {studentAttempts.slice(0, 5).map(att => {
                      const studentName = att.profiles?.full_name || "Học viên ẩn danh";
                      const scoreDisplay = `${att.score} / ${att.total_questions}`;
                      const takenAtLabel = new Date(att.taken_at).toLocaleString('vi-VN');
                      return (
                        <tr key={att.id} className="hover:bg-slate-50/30 transition-all">
                          <td className="py-3 px-5 font-bold text-[#001e40]">{studentName}</td>
                          <td className="py-3 px-5 text-slate-500 truncate max-w-xs">{att.exams?.title}</td>
                          <td className="py-3 px-5">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-750 border border-blue-100 rounded-full font-bold text-[9px]">
                              {scoreDisplay}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-slate-400 text-[10px]">{takenAtLabel}</td>
                        </tr>
                      );
                    })}
                    {studentAttempts.length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-slate-400 italic">
                          Chưa có lượt nộp bài nào trên hệ thống.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'editor' && (
          <>
            {/* BỘ BIÊN SOẠN ĐỀ THI WORD (.DOCX) - TÍCH HỢP CONVERTER & PREVIEW TRỰC TIẾP */}
            <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-150 bg-slate-50/50">
            <h2 className="font-display text-base font-bold text-[#001e40]">Bộ Biên Soạn Đề Thi Trực Tuyến Tự Động</h2>
            <p className="text-slate-400 text-[10px] mt-0.5">Tải lên tệp đề thi và đáp án Word để tự động bóc tách bài đọc, câu hỏi và xem trước Study4 tức thì.</p>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Uploader Form Controls */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wide">Khóa học đích</label>
                <select 
                  value={examCourseId}
                  onChange={(e) => setExamCourseId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-blue-600 bg-white font-semibold"
                >
                  <option value="">-- Chọn Khóa Học Target --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title} ({c.code.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wide">Hình thức</label>
                <select 
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-blue-600 bg-white font-bold text-blue-700"
                >
                  <option value="test">Đề thi thử (Full Test)</option>
                  <option value="homework">Bài tập ôn tập (Practice)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wide">Kỹ năng</label>
                <select 
                  value={isListening ? 'listening' : 'reading'}
                  onChange={(e) => {
                    const val = e.target.value === 'listening';
                    setIsListening(val);
                    if (val) {
                      setExamDuration(40);
                    } else {
                      setExamDuration(60);
                    }
                  }}
                  className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-blue-600 bg-white font-bold text-slate-700"
                >
                  <option value="reading">Đọc (Reading)</option>
                  <option value="listening">Nghe (Listening)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wide">Thời gian (Phút)</label>
                <input 
                  type="number"
                  value={examDuration}
                  onChange={(e) => setExamDuration(parseInt(e.target.value) || 0)}
                  className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-blue-600 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wide">Tiêu đề (Tự động nhận diện)</label>
                <input 
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="Nhập tiêu đề hoặc để tự động nhận diện..."
                  className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-blue-600 font-semibold"
                />
              </div>
            </div>

            {/* Audio inputs if Listening selected */}
            {isListening && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl animate-fade-in">
                <div className="md:col-span-4 flex items-center gap-1.5 text-indigo-900 border-b border-indigo-100 pb-2">
                  <span className="material-symbols-outlined text-base font-bold">headphones</span>
                  <span className="text-xs font-extrabold uppercase tracking-wide">Link Audio Google Drive (Section 1 - 4)</span>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-indigo-850 uppercase tracking-wide">Section 1 Audio</label>
                  <input
                    type="text"
                    value={listeningAudio1}
                    onChange={(e) => setListeningAudio1(e.target.value)}
                    placeholder="Dán link Drive Audio Section 1..."
                    className="w-full text-xs border border-indigo-200 focus:border-indigo-650 focus:ring-1 focus:ring-indigo-100 rounded-xl py-2 px-3 bg-white font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-indigo-850 uppercase tracking-wide">Section 2 Audio</label>
                  <input
                    type="text"
                    value={listeningAudio2}
                    onChange={(e) => setListeningAudio2(e.target.value)}
                    placeholder="Dán link Drive Audio Section 2..."
                    className="w-full text-xs border border-indigo-200 focus:border-indigo-650 focus:ring-1 focus:ring-indigo-100 rounded-xl py-2 px-3 bg-white font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-indigo-850 uppercase tracking-wide">Section 3 Audio</label>
                  <input
                    type="text"
                    value={listeningAudio3}
                    onChange={(e) => setListeningAudio3(e.target.value)}
                    placeholder="Dán link Drive Audio Section 3..."
                    className="w-full text-xs border border-indigo-200 focus:border-indigo-650 focus:ring-1 focus:ring-indigo-100 rounded-xl py-2 px-3 bg-white font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-indigo-850 uppercase tracking-wide">Section 4 Audio</label>
                  <input
                    type="text"
                    value={listeningAudio4}
                    onChange={(e) => setListeningAudio4(e.target.value)}
                    placeholder="Dán link Drive Audio Section 4..."
                    className="w-full text-xs border border-indigo-200 focus:border-indigo-650 focus:ring-1 focus:ring-indigo-100 rounded-xl py-2 px-3 bg-white font-medium"
                  />
                </div>
              </div>
            )}

            {/* File selection boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col items-center text-center justify-center space-y-3">
                <span className="material-symbols-outlined text-3xl text-indigo-600">menu_book</span>
                <div>
                  <h4 className="text-xs font-bold text-[#001e40]">Tệp Đề Thi (.docx)</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    {isListening 
                      ? "File chứa 4 Section bắt đầu bằng thẻ SECTION 1/2/3/4" 
                      : "File chứa 3 Passage bắt đầu bằng thẻ READING PASSAGE 1/2/3"}
                  </p>
                </div>
                <label className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold hover:bg-slate-100 hover:border-indigo-500 cursor-pointer shadow-sm transition-all active:scale-95">
                  {docxTestFile ? `📄 ${docxTestFile.name}` : "Chọn File Word Đề Thi"}
                  <input 
                    type="file" 
                    accept=".docx" 
                    className="hidden" 
                    onChange={(e) => setDocxTestFile(e.target.files[0])}
                  />
                </label>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col items-center text-center justify-center space-y-3">
                <span className="material-symbols-outlined text-3xl text-indigo-600">done_all</span>
                <div>
                  <h4 className="text-xs font-bold text-[#001e40]">Tệp Đáp Án (.docx / key)</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">File Word hoặc Text chứa đáp án các câu từ 1 đến 40</p>
                </div>
                <label className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold hover:bg-slate-100 hover:border-indigo-500 cursor-pointer shadow-sm transition-all active:scale-95">
                  {docxKeyFile ? `📄 ${docxKeyFile.name}` : "Chọn File Word Đáp Án"}
                  <input 
                    type="file" 
                    accept=".docx" 
                    className="hidden" 
                    onChange={(e) => setDocxKeyFile(e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            {/* Convert action trigger */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleDocxConvert}
                disabled={convertingDocx || !docxTestFile || !docxKeyFile}
                className="px-10 py-3.5 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white font-extrabold text-xs rounded-xl shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-97 flex items-center justify-center gap-2"
              >
                {convertingDocx ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang bóc tách đề thi...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm font-bold">query_stats</span>
                    <span>CHUYỂN ĐỔI ĐỀ THI (.DOCX) ĐỂ XEM TRƯỚC ⚡</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </section>

        {/* 2. PREMIUM STUDY4 STYLE PREVIEW - ONLY RENDERS IF CONVERTED */}
        {previewActive && convertedExam && (
          <section className="bg-white border border-slate-200 rounded-3xl shadow-md overflow-hidden flex flex-col p-6 animate-fade-in space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-150 pb-4">
              <div>
                <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-[9px] font-bold text-indigo-700 uppercase tracking-widest">
                  Preview Mode
                </span>
                <h3 className="font-display font-extrabold text-sm text-[#001e40] mt-1">Giả Lập Phòng Thi Trực Tuyến Học Viên (Study4 UI)</h3>
                <p className="text-[10px] text-slate-400">Rà soát lại hiển thị văn bản, câu hỏi và đáp án trước khi nhấn xuất bản lên hệ thống.</p>
              </div>

              {/* Highlight switch */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 shadow-sm text-xs font-semibold text-slate-600">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={highlightEnabled}
                    onChange={(e) => setHighlightEnabled(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-600 border-slate-300 w-3.5 h-3.5"
                  />
                  <span>Tô sáng từ vựng khóa</span>
                </label>
              </div>
            </div>

            {/* Top audio player bar */}
            {isListening && (
              <div className="px-1 py-1 shrink-0 bg-transparent mb-3">
                <div className="w-full mx-auto flex items-center gap-3">
                  {activePart?.audio_url && (activePart.audio_url.includes('drive.google.com') || activePart.audio_url.includes('docs.google.com')) ? (
                    <iframe
                      key={activePart.audio_url}
                      src={convertGoogleDrivePdfLink(activePart.audio_url)}
                      className="w-full h-[55px] rounded-xl border-0 bg-transparent"
                      allow="autoplay"
                    />
                  ) : (
                    <audio
                      key={activePart?.audio_url}
                      src={convertGoogleDriveAudioLink(activePart?.audio_url)}
                      controls
                      className="w-full h-8 outline-none"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Split Screen Simulated Mock Test area */}
            <div className="h-[550px] w-full flex flex-col lg:flex-row gap-6 p-1 overflow-hidden min-h-0">
              
              {/* Passage Column (Left - 48% width) */}
              <div className="w-full lg:w-[48%] bg-white border border-slate-150 rounded-2xl p-5 shadow-sm flex flex-col lg:h-full relative overflow-hidden min-w-0">
                {/* Passage tabs swapper */}
                <div className="flex overflow-x-auto gap-1 border-b border-slate-150 pb-2 mb-3 shrink-0 max-w-full custom-preview-scrollbar">
                  {convertedExam.test_parts.map((p, idx) => (
                    <button
                      key={p.part_code}
                      onClick={() => setActivePartIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold shrink-0 transition-all ${activePartIdx === idx ? 'bg-[#001e40] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                    >
                      {p.part_name}
                    </button>
                  ))}
                </div>

                <div className="flex-grow overflow-y-auto pr-2 custom-preview-scrollbar min-h-0 select-text">
                  {activePart?.part_content ? (
                    <div
                      className={`study4-passage ${highlightEnabled ? 'has-highlights' : ''}`}
                      dangerouslySetInnerHTML={{
                        __html: highlightEnabled 
                          ? activePart.part_content.replace(/(A\.\s|B\.\s|C\.\s|D\.\s|Paragraph [A-G])/g, '<span class="highlighted-text">$1</span>')
                          : activePart.part_content
                      }}
                    />
                  ) : (
                    <div className="text-center py-20 text-slate-400 text-xs">
                      Không có văn bản bài đọc cho phần này.
                    </div>
                  )}
                </div>
              </div>

              {/* Bubble Sheet Column (Middle - 42% width) */}
              <div className="w-full lg:w-[42%] shrink-0 bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex flex-col lg:h-full overflow-hidden min-w-0">
                <div className="border-b border-slate-150 pb-2 mb-2 shrink-0 flex justify-between items-center text-xs font-bold text-[#001e40]">
                  <span>Phiếu Trả Lời Đề Thi</span>
                  <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full">
                    {Object.keys(studentAnswers).filter(k => activeQuestions.some(q => q.id === parseInt(k) || q.id === k)).length} / {activeQuestions.length} câu
                  </span>
                </div>

                <div className="flex-grow overflow-y-auto pr-1 space-y-3 custom-preview-scrollbar text-[11px] min-h-0">
                  {(() => {
                    let lastInstruction = null;

                    return activeQuestions.map((q) => {
                      const selectedOpt = studentAnswers[q.id];
                      
                      const isTFN = q.options && q.options.length > 0 && q.options.every(opt => {
                        const u = opt.trim().toUpperCase();
                        return u === 'YES' || u === 'NO' || u === 'NOT GIVEN' || u === 'TRUE' || u === 'FALSE';
                      });

                      const isAK = q.options && q.options.length > 4 && (
                        q.options.length > 5 ||
                        q.options.some(opt => {
                          const match = opt.trim().match(/^([A-K])[\.\-\)\s\u00A0]/i);
                          return match && ['F', 'G', 'H', 'I', 'J', 'K'].includes(match[1].toUpperCase());
                        })
                      );

                      const hasOptions = q.options && q.options.length > 0 && !isTFN && !isAK;

                      let instructionBlock = null;
                      if (q.instruction && q.instruction.trim() !== lastInstruction && !isListening) {
                        lastInstruction = q.instruction.trim();
                        if (isTFN) {
                          instructionBlock = (
                            <div className="bg-[#f8fafc] border-l-4 border-[#001e40] p-3.5 rounded-xl my-3 shadow-sm select-text">
                              <h4 className="font-extrabold text-[9px] text-[#001e40] uppercase tracking-wider mb-1">TRUE / FALSE / NOT GIVEN</h4>
                              <p className="text-[9.5px] italic text-slate-600 leading-relaxed whitespace-pre-wrap">{q.instruction}</p>
                            </div>
                          );
                        } else if (isAK) {
                          instructionBlock = (
                            <div className="bg-[#f8fafc] border-l-4 border-indigo-650 p-3.5 rounded-xl my-3 shadow-sm select-text">
                              <h4 className="font-extrabold text-[9px] text-indigo-700 uppercase tracking-wider mb-1">COMPLETE MATCHING CHOICES</h4>
                              {q.instruction && <p className="text-[9.5px] italic text-slate-600 leading-relaxed mb-2 whitespace-pre-wrap">{q.instruction}</p>}
                              <ul className="grid grid-cols-1 gap-1.5 pl-0">
                                {q.options.map(opt => (
                                  <li key={opt} className="text-[9.5px] text-slate-700 list-none pl-2 border-l-2 border-slate-200">{opt}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        } else {
                          instructionBlock = (
                            <div className="bg-[#f8fafc] border-l-4 border-slate-400 p-3 rounded-xl my-3 select-text">
                              <p className="text-[9.5px] font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">{q.instruction}</p>
                            </div>
                          );
                        }
                      }

                      return (
                        <React.Fragment key={q.id}>
                          {instructionBlock}
                          <div
                            key={q.id}
                            id={`preview-q-card-${q.id}`}
                            className="flex items-start gap-3 py-2.5 px-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-all bg-white shadow-sm"
                          >
                            <span className="w-6 h-6 rounded-full bg-[#001e40]/10 text-[#001e40] font-extrabold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                              {q.id}
                            </span>

                            <div className="flex-grow min-w-0">
                              {q.question && !isListening && (
                                <div className="text-[10px] font-bold text-slate-800 mb-1.5 leading-snug">
                                  {q.question}
                                </div>
                              )}

                              {hasOptions && !isListening ? (
                                <div className="w-full pt-0.5">
                                  <div className="w-full flex flex-col gap-1">
                                    {q.options.map((opt) => {
                                      const optMatch = opt.trim().match(/^([A-K])[\.\-\)\s\u00A0]*\s*(.*)$/i);
                                      const letter = optMatch ? optMatch[1].toUpperCase() : '';
                                      const description = optMatch ? optMatch[2].trim() : opt.trim();
                                      const isSelected = selectedOpt === letter;
                                      
                                      return (
                                        <div
                                          key={opt}
                                          onClick={() => selectPreviewAnswer(q.id, letter || opt)}
                                          className={`flex items-start gap-2 p-1.5 rounded-lg border text-[9px] cursor-pointer transition-all hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/30 border-indigo-500 text-indigo-950 font-semibold' : 'border-slate-100 text-slate-600'}`}
                                        >
                                          <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border text-[8px] font-extrabold ${isSelected ? 'bg-[#001e40] border-[#001e40] text-white' : 'border-slate-300 text-slate-500 bg-white'}`}>
                                            {letter}
                                          </span>
                                          <span className="leading-normal pt-0.5">{description}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={studentAnswers[q.id] || ''}
                                  onChange={(e) => selectPreviewAnswer(q.id, e.target.value)}
                                  placeholder="Nhập câu trả lời..."
                                  className="w-full border border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] rounded-lg px-2.5 py-1 text-[9px] font-semibold focus:outline-none bg-white text-slate-800"
                                />
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Sidebar Column (Right - 10% width) */}
              <div className="w-full lg:w-[10%] shrink-0 flex flex-col gap-4 lg:h-full overflow-hidden">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center items-center shadow-sm shrink-0 gap-1.5">
                  <span className="block text-[8px] font-bold text-slate-450 uppercase tracking-wider">Thời gian xem trước</span>
                  <span className="font-bold text-xl font-mono text-[#001e40]">{formatStopwatch()}</span>
                  <button
                    type="button"
                    onClick={handlePreviewSubmit}
                    className="w-full bg-[#001e40] hover:bg-[#003366] text-white font-extrabold text-[9px] py-2.5 rounded-lg transition-all shadow active:scale-97 flex items-center justify-center gap-1"
                  >
                    NỘP BÀI THỬ
                  </button>
                </div>

                <div className="bg-white border border-slate-150 p-4 rounded-xl flex flex-col shadow-sm flex-grow min-h-0 overflow-hidden">
                  <span className="block text-[8px] font-extrabold text-slate-450 uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-100 shrink-0">
                    Bản Đồ Câu Hỏi
                  </span>
                  <div className="flex-grow overflow-y-auto pr-1 custom-preview-scrollbar space-y-3 min-h-0">
                    {convertedExam.test_parts.map((part, pIdx) => {
                      if (!part.questions || part.questions.length === 0) return null;
                      return (
                        <div key={part.part_code} className="space-y-1">
                          <h4 className="text-[7.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                            {part.part_name}
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {part.questions.map((q) => {
                              const isAnswered = !!studentAnswers[q.id];
                              const isActive = activePartIdx === pIdx;
                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => handlePreviewMapClick(pIdx, q.id)}
                                  className={`w-7 h-7 font-extrabold text-[9px] flex items-center justify-center rounded-md transition-all border shrink-0 ${isAnswered ? 'bg-[#001e40] border-[#001e40] text-white shadow-sm' : isActive ? 'border-[#001e40] text-[#001e40] bg-indigo-50/50' : 'border-slate-200 text-slate-440'}`}
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
              </div>
            </div>

            {/* Packaged Action panel for exports and direct db pushes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-150 pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={publishToSupabase}
                  disabled={publishing}
                  className="flex-grow py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-850 text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50 transition-all active:scale-97 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm font-bold">cloud_upload</span>
                  {publishing ? 'Đang xuất bản...' : 'ĐĂNG TRỰC TIẾP LÊN SUPABASE'}
                </button>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("🗑️ Bạn có chắc chắn muốn hủy bản convert hiện tại để chọn file khác?")) {
                      setConvertedExam(null);
                      setPreviewActive(false);
                      setDocxTestFile(null);
                      setDocxKeyFile(null);
                      setExamTitle('');
                      setIsListening(false);
                      setListeningAudio1('');
                      setListeningAudio2('');
                      setListeningAudio3('');
                      setListeningAudio4('');
                    }
                  }}
                  className="px-6 py-3 bg-white border border-slate-250 hover:bg-red-50 hover:border-red-300 text-red-600 hover:text-red-700 rounded-xl text-xs font-bold transition-all active:scale-97 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  Hủy bản nháp
                </button>
              </div>
            </div>

          </section>
        )}
      </>
    )}

        {/* Hàng chứa Kho đề thi và Kết quả học viên (Nằm bên dưới, chia thành 2 cột song song trên màn hình rộng) */}
        {activeTab === 'exams' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in font-semibold">
            
            {/* Published Exams / Practice */}
            <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col max-h-[500px]">
              <div className="p-5 border-b border-slate-150 bg-slate-50/50">
                <h3 className="font-display text-sm font-bold text-[#001e40]">Kho Bài Giảng & Đề Đã Đăng</h3>
                <p className="text-slate-400 text-[9px]">Lọc, tìm kiếm hoặc xóa hoàn toàn dữ liệu đề thi trên bảng lưu trữ.</p>
              </div>

              <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-preview-scrollbar">
                {publishedExams.map(ex => (
                  <div key={ex.id} className="p-3 border border-slate-100 hover:border-blue-500/20 rounded-2xl bg-white transition-all flex items-center justify-between gap-3 group">
                    <div className="flex-grow min-w-0 space-y-1">
                      <h4 className="font-extrabold text-xs text-[#001e40] truncate" title={ex.title}>{ex.title}</h4>
                      <div className="flex flex-wrap items-center gap-x-2 text-[9px] font-bold text-slate-450">
                        <span className="text-blue-700 uppercase">{ex.courses?.title?.split(' ')[0]}</span>
                        <span>•</span>
                        <span className={`px-1 rounded ${ex.type === 'homework' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {ex.type === 'homework' ? 'Bài tập' : 'Full Test'}
                        </span>
                        <span>•</span>
                        <span>{ex.duration || 60} phút</span>
                        <span>•</span>
                        <span>{ex.question_count} câu hỏi</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a 
                        href={`/exam-taker/${ex.id}?mode=teacher_review`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-xl text-[10px] font-extrabold transition-all border border-emerald-200"
                        title="Xem lại đề thi & đáp án"
                      >
                        <span className="material-symbols-outlined text-[14px] font-bold">visibility</span>
                        <span>Xem đề</span>
                      </a>
                      <button 
                        onClick={() => handleStartEdit(ex)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Chỉnh sửa đề thi"
                      >
                        <span className="material-symbols-outlined text-[16px] font-bold">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteExam(ex.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Xóa đề vĩnh viễn"
                      >
                        <span className="material-symbols-outlined text-[16px] font-bold">delete_forever</span>
                      </button>
                    </div>
                  </div>
                ))}

              {publishedExams.length === 0 && (
                <p className="text-center py-10 text-slate-400 italic text-xs">Chưa có bài tập/đề thi nào.</p>
              )}
            </div>
          </section>

          {/* Student Exam Attempts */}
          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col max-h-[500px]">
            <div className="p-5 border-b border-slate-150 bg-slate-50/50">
              <h3 className="font-display text-sm font-bold text-[#001e40]">Kết Quả Làm Bài Của Học Viên</h3>
              <p className="text-slate-450 text-[9px]">Xem tiến độ học tập và điểm số mới nhất của lớp học.</p>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-preview-scrollbar">
              {loadingAttempts ? (
                <p className="text-center py-10 text-slate-400 italic text-xs">Đang nạp kết quả...</p>
              ) : studentAttempts.map(att => {
                const studentName = att.profiles?.full_name || "Học viên ẩn danh";
                const scoreDisplay = `${att.score} / ${att.total_questions}`;
                return (
                  <div key={att.id} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between gap-3 text-xs bg-slate-50/30">
                    <div>
                      <p className="font-bold text-[#001e40]">{studentName}</p>
                      <p className="text-[9px] text-slate-450 truncate max-w-[200px]" title={att.exams?.title}>{att.exams?.title}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-full font-extrabold text-[9px]">
                      {scoreDisplay}
                    </span>
                  </div>
                );
              })}

              {studentAttempts.length === 0 && (
                <p className="text-center py-10 text-slate-400 italic text-xs">Chưa có học viên nào nộp bài.</p>
              )}
            </div>
          </section>

        </div>
      )}

      {/* TAB 4: QUẢN LÝ LỚP HỌC */}
      {activeTab === 'classes' && (
        <div className="space-y-8 animate-fade-in font-semibold">
          {/* Warning banner if mockMode is active */}
          {mockMode && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm">
              <span className="material-symbols-outlined text-amber-600 font-bold text-2xl">warning</span>
              <div className="space-y-1">
                <h4 className="text-amber-850 font-bold text-sm">Chế độ giả lập (Mock Mode) đang kích hoạt</h4>
                <p className="text-amber-700 text-xs leading-relaxed font-medium">
                  Hệ thống tự động chuyển sang chế độ giả lập dữ liệu do chưa phát hiện thấy bảng <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">classes</code> và <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">assignments</code> trong cơ sở dữ liệu Supabase của bạn.
                </p>
                <p className="text-amber-700 text-xs font-semibold mt-1">
                  👉 Hướng dẫn: Copy và chạy các lệnh SQL trong file <a href="file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/CAP_NHAT_DATABASE.sql" className="underline font-bold text-amber-800">CAP_NHAT_DATABASE.sql</a> trong Supabase SQL Editor để đồng bộ cấu trúc cơ sở dữ liệu thực tế.
                </p>
              </div>
            </div>
          )}

          {/* Overview Table of Classes */}
          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-150 bg-slate-50/50">
              <h3 className="font-display text-base font-bold text-[#001e40]">Danh Sách Lớp Học & Bài Giảng</h3>
              <p className="text-slate-400 text-[10px] mt-0.5 font-semibold text-slate-500">Kiểm soát số lượng học viên, số bài giảng đã đăng của từng lớp học.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-3.5 px-6">Tên lớp học</th>
                    <th className="py-3.5 px-6">Khóa học đích</th>
                    <th className="py-3.5 px-6">Số học viên</th>
                    <th className="py-3.5 px-6">Số bài đã giao</th>
                    <th className="py-3.5 px-6 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {classes.map(cls => {
                    const studentCount = mockMode 
                      ? (cls.student_count || 0)
                      : students.filter(s => s.class_id === cls.id).length;
                    
                    const assignCount = mockMode
                      ? (cls.assignment_count || 0)
                      : assignments.filter(a => a.class_id === cls.id).length;

                    const targetCourse = courses.find(c => c.id === cls.course_id);
                    const courseName = targetCourse ? targetCourse.title : (cls.courses?.title || 'Chưa rõ');

                    return (
                      <tr key={cls.id} className="hover:bg-slate-50/30 transition-all font-medium text-slate-700">
                        <td className="py-4 px-6 font-bold text-[#001e40]">{cls.name}</td>
                        <td className="py-4 px-6 text-slate-550">{courseName}</td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-750 rounded-full font-bold text-[10px]">
                            {studentCount} học viên
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-750 rounded-full font-bold text-[10px]">
                            {assignCount} bài giao
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`🗑️ Bạn có chắc muốn xóa lớp "${cls.name}"?`)) return;
                              if (mockMode) {
                                setClasses(prev => prev.filter(c => c.id !== cls.id));
                                setStudents(prev => prev.map(s => s.class_id === cls.id ? { ...s, class_id: null, class_name: null } : s));
                                showToast("[MOCK MODE] Đã xóa lớp học thành công!");
                                return;
                              }
                              try {
                                const { error } = await supabase.from('classes').delete().eq('id', cls.id);
                                if (error) throw error;
                                showToast("Đã xóa lớp học thành công!");
                                fetchClasses();
                                fetchStudents();
                              } catch (err) {
                                alert("Lỗi khi xóa lớp: " + err.message);
                              }
                            }}
                            className="text-slate-455 hover:text-red-650 transition-all p-1"
                            title="Xóa lớp học"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {classes.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-slate-400 italic">
                        Chưa có lớp học nào được tạo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Submanagement tools grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Create Class */}
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-blue-600 font-bold text-xl">domain_add</span>
                  <h4 className="font-display text-sm font-bold text-[#001e40]">Tạo Lớp Học Mới</h4>
                </div>
                <form onSubmit={handleCreateClass} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Tên lớp học</label>
                    <input
                      type="text"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="Vd: IELTS IELTS-103, TOEIC-650, ..."
                      className="w-full border border-slate-200 focus:border-blue-655 rounded-xl py-2 px-3 focus:outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Khóa học tương ứng</label>
                    <select
                      value={newClassCourseId}
                      onChange={(e) => setNewClassCourseId(e.target.value)}
                      className="w-full border border-slate-200 focus:border-blue-655 rounded-xl py-2.5 px-3 focus:outline-none bg-white font-semibold text-slate-850"
                    >
                      <option value="">-- Chọn Khóa Học Target --</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title} ({c.code.toUpperCase()})</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingClass}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-2.5 transition-all font-bold active:scale-95 shadow disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submittingClass ? 'Đang tạo...' : 'TẠO LỚP HỌC'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Assign Homework to Class */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-150">
                <span className="material-symbols-outlined text-indigo-600 font-bold text-xl">assignment_turned_in</span>
                <h4 className="font-display text-sm font-bold text-[#001e40]">Giao Bài Tập Cho Lớp Học</h4>
              </div>
              <form 
                onSubmit={(e) => {
                  setAssignHomeworkTargetType('class');
                  handleAssignHomework(e, 'class');
                }} 
                className="space-y-4 text-xs font-semibold"
              >
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Chọn đề thi / bài tập</label>
                  <select
                    value={assignHomeworkExamId}
                    onChange={(e) => setAssignHomeworkExamId(e.target.value)}
                    className="w-full border border-slate-200 focus:border-blue-655 rounded-xl py-2.5 px-3 focus:outline-none bg-white font-semibold text-slate-850"
                  >
                    <option value="">-- Chọn Bài Tập/Đề Thi Đã Đăng --</option>
                    {publishedExams.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        [{ex.type === 'homework' ? 'Bài tập' : 'Full Test'}] {ex.title} ({ex.courses?.title?.split(' ')[0]})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Chọn lớp học nhận bài</label>
                  <select
                    value={assignHomeworkClassId}
                    onChange={(e) => setAssignHomeworkClassId(e.target.value)}
                    className="w-full border border-slate-200 focus:border-blue-655 rounded-xl py-2.5 px-3 focus:outline-none bg-white font-semibold text-slate-850"
                  >
                    <option value="">-- Chọn Lớp Học Nhận Bài --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Hạn chót nộp bài (Due date)</label>
                  <input
                    type="date"
                    value={assignHomeworkDueDate}
                    onChange={(e) => setAssignHomeworkDueDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.target.showPicker();
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="w-full border border-slate-200 focus:border-blue-655 rounded-xl py-2 px-3 focus:outline-none bg-white font-medium text-slate-800 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingHomeworkAssign}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 transition-all font-bold active:scale-95 shadow disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submittingHomeworkAssign ? 'Đang giao...' : 'GIAO BÀI TẬP CHO LỚP'}
                </button>
              </form>
            </div>
          </div>

          {/* List of Active Class Assignments */}
          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-150 bg-slate-50/50">
              <h3 className="font-display text-base font-bold text-[#001e40]">Danh Sách Bài Tập Lớp Đã Giao</h3>
              <p className="text-slate-400 text-[10px] mt-0.5 font-semibold text-slate-500">Theo dõi và thu hồi các bài tập, bài kiểm tra đang được giao cho các lớp học.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-3.5 px-6">Tên đề thi / bài tập</th>
                    <th className="py-3.5 px-6">Lớp học nhận</th>
                    <th className="py-3.5 px-6">Hạn chót nộp bài</th>
                    <th className="py-3.5 px-6">Ngày giao bài</th>
                    <th className="py-3.5 px-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {assignments.filter(ass => ass.class_id !== null).map(ass => {
                    const examTitle = ass.exams?.title || ass.exam_title || 'Đề thi đã xóa';
                    const targetLabel = `Lớp: ${ass.classes?.name || ass.class_name || 'Lớp đã xóa'}`;
                    
                    const dueDateLabel = ass.due_date 
                      ? new Date(ass.due_date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) 
                      : 'Không giới hạn';
                    
                    const createdAtLabel = new Date(ass.created_at).toLocaleDateString('vi-VN');

                    return (
                      <tr key={ass.id} className="hover:bg-slate-50/30 transition-all">
                        <td className="py-4 px-6 font-bold text-[#001e40]">{examTitle}</td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-blue-50 text-blue-800">
                            {targetLabel}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-rose-655 font-bold">{dueDateLabel}</td>
                        <td className="py-4 px-6 text-slate-450">{createdAtLabel}</td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAssignment(ass.id)}
                            className="text-red-500 hover:text-red-700 transition-all p-1 flex items-center justify-center inline-flex"
                            title="Thu hồi bài tập"
                          >
                            <span className="material-symbols-outlined text-lg">cancel</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {assignments.filter(ass => ass.class_id !== null).length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-slate-400 italic">
                        Chưa có bài tập lớp nào được giao.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 5: QUẢN LÝ HỌC VIÊN */}
      {activeTab === 'students' && (
        <div className="space-y-8 animate-fade-in font-semibold">
          {/* Warning banner if mockMode is active */}
          {mockMode && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm">
              <span className="material-symbols-outlined text-amber-600 font-bold text-2xl">warning</span>
              <div className="space-y-1">
                <h4 className="text-amber-850 font-bold text-sm">Chế độ giả lập (Mock Mode) đang kích hoạt</h4>
                <p className="text-amber-700 text-xs leading-relaxed font-medium">
                  Hệ thống tự động chuyển sang chế độ giả lập dữ liệu do chưa phát hiện thấy bảng <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">classes</code> và <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">assignments</code> trong cơ sở dữ liệu Supabase của bạn.
                </p>
                <p className="text-amber-700 text-xs font-semibold mt-1">
                  👉 Hướng dẫn: Copy và chạy các lệnh SQL trong file <a href="file:///d:/RINNDL/web%20ti%E1%BA%BFng%20anh/CAP_NHAT_DATABASE.sql" className="underline font-bold text-amber-800">CAP_NHAT_DATABASE.sql</a> trong Supabase SQL Editor để đồng bộ cấu trúc cơ sở dữ liệu thực tế.
                </p>
              </div>
            </div>
          )}

          {/* Filter controls */}
          <div className="flex flex-col md:flex-row gap-4 bg-white border border-slate-200 p-5 rounded-3xl shadow-sm justify-between items-center">
            <div className="w-full md:max-w-md relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450 text-lg">search</span>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm học viên theo tên hoặc email..."
                className="w-full border border-slate-200 focus:border-blue-655 rounded-xl py-2 pl-10 pr-4 focus:outline-none bg-white text-xs font-medium text-slate-800"
              />
            </div>

            <div className="w-full md:w-64 flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 whitespace-nowrap">Lọc Lớp:</span>
              <select
                value={studentClassFilter}
                onChange={(e) => setStudentClassFilter(e.target.value)}
                className="w-full border border-slate-200 focus:border-blue-655 rounded-xl py-2 px-3 focus:outline-none bg-white font-semibold text-slate-850 text-xs"
              >
                <option value="">Tất cả các lớp</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="none">Chưa xếp lớp</option>
              </select>
            </div>
          </div>

          {/* Students List Table */}
          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-150 bg-slate-50/50">
              <h3 className="font-display text-base font-bold text-[#001e40]">Bảng Quản Lý Học Viên</h3>
              <p className="text-slate-400 text-[10px] mt-0.5 font-semibold text-slate-500">Xem danh sách học viên hiện có và thay đổi lớp trực tiếp bằng ô lựa chọn.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-3.5 px-6">Tên học viên</th>
                    <th className="py-3.5 px-6">Email đăng ký</th>
                    <th className="py-3.5 px-6">Lớp học hiện tại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {students
                    .filter(s => {
                      const matchesSearch = s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) || 
                                            s.email?.toLowerCase().includes(studentSearch.toLowerCase());
                      const matchesClass = !studentClassFilter 
                        ? true 
                        : studentClassFilter === 'none' 
                          ? !s.class_id 
                          : s.class_id === studentClassFilter;
                      return matchesSearch && matchesClass;
                    })
                    .map(student => {
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/30 transition-all">
                          <td className="py-4 px-6 font-bold text-[#001e40]">{student.full_name || 'Chưa đặt tên'}</td>
                          <td className="py-4 px-6 text-slate-505">{student.email || 'N/A'}</td>
                          <td className="py-4 px-6">
                            <select
                              value={student.class_id || ''}
                              onChange={(e) => handleUpdateStudentClass(student.id, e.target.value)}
                              className="border border-slate-200 focus:border-blue-650 rounded-xl py-1 px-2 focus:outline-none bg-white font-semibold text-slate-800 text-xs"
                            >
                              <option value="">Chưa xếp lớp</option>
                              {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  {students.filter(s => {
                    const matchesSearch = s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) || 
                                          s.email?.toLowerCase().includes(studentSearch.toLowerCase());
                    const matchesClass = !studentClassFilter 
                      ? true 
                      : studentClassFilter === 'none' 
                        ? !s.class_id 
                        : s.class_id === studentClassFilter;
                    return matchesSearch && matchesClass;
                  }).length === 0 && (
                    <tr>
                      <td colSpan="3" className="py-10 text-center text-slate-400 italic">
                        Không tìm thấy học viên nào phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Individual student assignment section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Form to assign homework to individual student */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 lg:col-span-1">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-150">
                <span className="material-symbols-outlined text-[#001e40] font-bold text-xl">person</span>
                <h4 className="font-display text-sm font-bold text-[#001e40]">Giao Bài Tập Cho Học Viên</h4>
              </div>
              <form 
                onSubmit={(e) => {
                  setAssignHomeworkTargetType('student');
                  handleAssignHomework(e, 'student');
                }}
                className="space-y-4 text-xs font-semibold"
              >
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Chọn đề thi / bài tập</label>
                  <select
                    value={assignHomeworkExamId}
                    onChange={(e) => setAssignHomeworkExamId(e.target.value)}
                    className="w-full border border-slate-200 focus:border-[#001e40] rounded-xl py-2 px-3 focus:outline-none bg-white font-semibold text-slate-800"
                  >
                    <option value="">-- Chọn Bài Tập/Đề Thi --</option>
                    {publishedExams.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        [{ex.type === 'homework' ? 'Bài tập' : 'Full Test'}] {ex.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Chọn học viên nhận bài</label>
                  <select
                    value={assignHomeworkStudentId}
                    onChange={(e) => setAssignHomeworkStudentId(e.target.value)}
                    className="w-full border border-slate-200 focus:border-[#001e40] rounded-xl py-2 px-3 focus:outline-none bg-white font-semibold text-slate-800"
                  >
                    <option value="">-- Chọn Học Viên --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Hạn chót nộp bài</label>
                  <input
                    type="date"
                    value={assignHomeworkDueDate}
                    onChange={(e) => setAssignHomeworkDueDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.target.showPicker();
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="w-full border border-slate-200 focus:border-[#001e40] rounded-xl py-2 px-3 focus:outline-none bg-white font-medium text-slate-800 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingHomeworkAssign}
                  className="w-full bg-[#001e40] hover:bg-[#003366] text-white rounded-xl py-2.5 transition-all font-bold active:scale-95 shadow disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submittingHomeworkAssign ? 'Đang giao...' : 'GIAO BÀI TẬP CÁ NHÂN'}
                </button>
              </form>
            </div>

            {/* Right Column: List of individual student assignments */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-150">
                <span className="material-symbols-outlined text-[#001e40] font-bold text-xl">assignment_ind</span>
                <h4 className="font-display text-sm font-bold text-[#001e40]">Danh Sách Bài Tập Cá Nhân Đã Giao</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[10px] font-extrabold uppercase tracking-wider">
                      <th className="py-3.5 px-6">Tên đề / bài tập</th>
                      <th className="py-3.5 px-6">Học viên nhận</th>
                      <th className="py-3.5 px-6">Hạn chót</th>
                      <th className="py-3.5 px-6">Ngày giao</th>
                      <th className="py-3.5 px-6 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {assignments.filter(ass => ass.student_id !== null).map(ass => {
                      const examTitle = ass.exams?.title || ass.exam_title || 'Đề thi đã xóa';
                      const targetLabel = ass.profiles?.full_name || ass.student_name || 'Học viên đã xóa';
                      const dueDateLabel = ass.due_date 
                        ? new Date(ass.due_date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) 
                        : 'Không giới hạn';
                      const createdAtLabel = new Date(ass.created_at).toLocaleDateString('vi-VN');

                      return (
                        <tr key={ass.id} className="hover:bg-slate-50/30 transition-all">
                          <td className="py-4 px-6 font-bold text-[#001e40]">{examTitle}</td>
                          <td className="py-4 px-6">
                            <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-50 text-amber-800">
                              {targetLabel}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-rose-650 font-bold">{dueDateLabel}</td>
                          <td className="py-4 px-6 text-slate-450">{createdAtLabel}</td>
                          <td className="py-4 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteAssignment(ass.id)}
                              className="text-red-500 hover:text-red-700 transition-all p-1 inline-flex items-center justify-center"
                              title="Thu hồi bài tập"
                            >
                              <span className="material-symbols-outlined text-lg">cancel</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {assignments.filter(ass => ass.student_id !== null).length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-10 text-center text-slate-400 italic">
                          Chưa có bài tập cá nhân nào được giao.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Edit Exam Modal */}
      {editingExam && (
        <div className="fixed inset-0 bg-[#001e40]/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-display text-sm font-bold text-[#001e40] flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 font-bold">edit</span>
                  Chỉnh Sửa Thông Tin Đề Thi
                </h3>
                <p className="text-slate-400 text-[9px] mt-0.5">Thay đổi thông tin cơ bản của đề thi hiện tại.</p>
              </div>
              <button 
                onClick={() => setEditingExam(null)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all active:scale-90"
              >
                <span className="material-symbols-outlined text-[14px] font-bold">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateExam} className="p-5 space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">Tiêu đề bài thi</label>
                <input 
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Nhập tên đề thi..."
                  className="w-full text-xs border border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] rounded-xl py-2 px-3 focus:outline-none font-semibold bg-white text-slate-800"
                />
              </div>

              {/* Course & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">Khóa học đích</label>
                  <select 
                    value={editCourseId}
                    onChange={(e) => setEditCourseId(e.target.value)}
                    className="w-full text-xs border border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] rounded-xl py-2 px-3 focus:outline-none bg-white font-semibold text-slate-800"
                  >
                    <option value="">-- Chọn Khóa Học Target --</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title} ({c.code.toUpperCase()})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">Hình thức</label>
                  <select 
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full text-xs border border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] rounded-xl py-2 px-3 focus:outline-none bg-white font-bold text-blue-700"
                  >
                    <option value="test">Đề thi thử (Full Test)</option>
                    <option value="homework">Bài tập ôn tập (Practice)</option>
                  </select>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1">
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">Thời gian làm bài (phút)</label>
                <input 
                  type="number"
                  value={editDuration}
                  onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                  placeholder="Thời gian thi..."
                  className="w-full text-xs border border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] rounded-xl py-2 px-3 focus:outline-none font-semibold bg-white text-slate-800"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingExam(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updatingExam}
                  className="px-5 py-2 bg-[#001e40] hover:bg-[#003366] text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {updatingExam ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xs font-bold">save</span>
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[99999] bg-[#001e40] text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-2 animate-slide-in">
          <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};

export default TeacherDashboard;
