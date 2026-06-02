import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

// Helper functions for link conversion
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

// Robust CSV Parser supporting RFC 4180 rules
const parseCsvDraft = (text) => {
  const result = [];
  let row = [];
  let currentVal = '';
  let insideQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      row.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal);
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        result.push(row);
      }
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  
  if (currentVal !== '' || row.length > 0) {
    row.push(currentVal);
    result.push(row);
  }
  
  return result;
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

// Helper to split options that got concatenated into a single block (e.g. from Word text boxes)
const splitEmbeddedOptions = (text) => {
  if (!text) return [];
  
  // Check if text has multiple options embedded, e.g. contains B and C and D transitions
  const hasMultiple = /[\.\s\u00A0][B-D][\.\-\)\s\u00A0]/i.test(text) && 
                      /[\.\s\u00A0][C-E][\.\-\)\s\u00A0]/i.test(text);
  
  if (!hasMultiple) {
    return [text];
  }
  
  // Split using a regex that looks for letter transitions A-K preceded by space/dot/punctuation
  const parts = text.split(/(?=\b[B-K][\.\-\)\s\u00A0])/i);
  return parts.map(p => p.trim()).filter(Boolean);
};



const IeltsConverter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Courses and UI management States
  const [courses, setCourses] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(true);

  // Configuration Fields
  const [examTitle, setExamTitle] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [examDuration, setExamDuration] = useState(60);
  const [examType, setExamType] = useState('test'); // 'test' (Full Test) or 'homework' (Practice)
  const [activeInputTab, setActiveInputTab] = useState('csv'); // 'csv', 'paste', 'aiken'
  const [isListening, setIsListening] = useState(false);

  // Raw Input Fields (pasted methods)
  const [rawPdfText, setRawPdfText] = useState('');
  const [rawAnswerKey, setRawAnswerKey] = useState('');
  const [rawAikenText, setRawAikenText] = useState('');
  
  // Word DOCX Parser States
  const [docxTestFile, setDocxTestFile] = useState(null);
  const [docxKeyFile, setDocxKeyFile] = useState(null);
  const [convertingDocx, setConvertingDocx] = useState(false);

  // Generated JSON Structure State
  const [convertedExam, setConvertedExam] = useState(null);

  // Mock Exam Interactive State
  const [activePartIdx, setActivePartIdx] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewActive, setPreviewActive] = useState(false);
  
  const timerRef = useRef(null);

  // Fetch target courses from Supabase
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setCoursesLoading(true);
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .order('title', { ascending: true });
        if (error) throw error;
        setCourses(data || []);
        if (data && data.length > 0) {
          const ieltsCourse = data.find(c => c.code === 'ielts');
          setTargetCourseId(ieltsCourse ? ieltsCourse.id : data[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh mục khóa học:', err);
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourses();
  }, []);

  // Run stopwatch simulation in interactive mode
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

  // Handle uploaded CSV draft file
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('⚠️ Vui lòng tải lên file CSV (.csv)!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = parseCsvDraft(text);
        if (rows.length <= 1) {
          alert('⚠️ File CSV trống hoặc tiêu đề không đúng chuẩn.');
          return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const colIdx = {
          qNum: headers.findIndex(h => h.includes('câu') || h.includes('q') || h.includes('id')),
          partName: headers.findIndex(h => h.includes('phần') || h.includes('section') || h.includes('part') || h.includes('passage')),
          partTitle: headers.findIndex(h => h.includes('tiêu đề') || h.includes('title')),
          partContent: headers.findIndex(h => h.includes('đoạn văn') || h.includes('nội dung') || h.includes('html') || h.includes('content')),
          qText: headers.findIndex(h => h.includes('câu hỏi') || h.includes('question') || h.includes('text')),
          optA: headers.findIndex(h => h.includes('a')),
          optB: headers.findIndex(h => h.includes('b')),
          optC: headers.findIndex(h => h.includes('c')),
          optD: headers.findIndex(h => h.includes('d')),
          optE: headers.findIndex(h => h.includes('e')),
          correct: headers.findIndex(h => h.includes('đáp án') || h.includes('correct') || h.includes('key'))
        };

        // Fallbacks
        if (colIdx.qNum === -1) colIdx.qNum = 0;
        if (colIdx.partName === -1) colIdx.partName = 1;
        if (colIdx.partTitle === -1) colIdx.partTitle = 2;
        if (colIdx.partContent === -1) colIdx.partContent = 3;
        if (colIdx.qText === -1) colIdx.qText = 4;
        if (colIdx.optA === -1) colIdx.optA = 5;
        if (colIdx.optB === -1) colIdx.optB = 6;
        if (colIdx.optC === -1) colIdx.optC = 7;
        if (colIdx.optD === -1) colIdx.optD = 8;
        if (colIdx.optE === -1) colIdx.optE = 9;
        if (colIdx.correct === -1) colIdx.correct = 10;

        const partsMap = {};
        let listeningFound = false;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 2) continue;

          const qNum = parseInt(row[colIdx.qNum]?.trim()) || i;
          const partName = row[colIdx.partName]?.trim() || 'Part 1';
          const partTitle = row[colIdx.partTitle]?.trim() || '';
          const partContent = row[colIdx.partContent]?.trim() || '';
          const qText = row[colIdx.qText]?.trim() || '';
          const correct = row[colIdx.correct]?.trim() || '';

          if (partName.toLowerCase().includes('listening') || partName.toLowerCase().includes('section') || partName.toLowerCase().includes('recording')) {
            listeningFound = true;
          }

          const options = [];
          const aVal = row[colIdx.optA]?.trim();
          const bVal = row[colIdx.optB]?.trim();
          const cVal = row[colIdx.optC]?.trim();
          const dVal = row[colIdx.optD]?.trim();
          const eVal = row[colIdx.optE]?.trim();

          if (aVal) options.push(aVal.startsWith('A.') ? aVal : `A. ${aVal}`);
          if (bVal) options.push(bVal.startsWith('B.') ? bVal : `B. ${bVal}`);
          if (cVal) options.push(cVal.startsWith('C.') ? cVal : `C. ${cVal}`);
          if (dVal) options.push(dVal.startsWith('D.') ? dVal : `D. ${dVal}`);
          if (eVal) options.push(eVal.startsWith('E.') ? eVal : `E. ${eVal}`);

          const partCode = partName.toLowerCase().replace(/[^a-z0-9]/g, '_');

          if (!partsMap[partCode]) {
            partsMap[partCode] = {
              part_code: partCode,
              part_name: partName,
              part_title: partTitle,
              part_content: partContent,
              questions: []
            };
          }

          partsMap[partCode].questions.push({
            id: qNum,
            question: qText,
            options,
            correct
          });
        }

        const sortedParts = Object.values(partsMap).sort((a, b) => {
          const aFirst = a.questions[0]?.id || 0;
          const bFirst = b.questions[0]?.id || 0;
          return aFirst - bFirst;
        });

        const totalQCount = sortedParts.reduce((acc, curr) => acc + curr.questions.length, 0);
        const guessedTitle = file.name.replace(/\.[^/.]+$/, "").replace(/_draft/i, "").replace(/_/g, ' ');
        const finalTitle = examTitle.trim() ? examTitle.trim() : guessedTitle;

        setExamTitle(finalTitle);
        setIsListening(listeningFound);
        setConvertedExam({
          title: finalTitle,
          course_id: targetCourseId,
          duration: listeningFound ? 40 : 60,
          type: examType,
          question_count: totalQCount,
          test_parts: sortedParts,
          questions: []
        });

        setSuccessMessage(`🎉 Chuyển đổi thành công! Nhận diện được ${sortedParts.length} Phần với tổng cộng ${totalQCount} Câu hỏi.`);
        setErrorMessage('');
        setPreviewActive(true);
        setActivePartIdx(0);
        setStudentAnswers({});
      } catch (err) {
        console.error(err);
        setErrorMessage(`⚠️ Lỗi phân tích file CSV: ${err.message}`);
        setSuccessMessage('');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Convert pasted PDF text & answer key
  const handlePastePdfAndAnswersConvert = () => {
    if (!rawPdfText.trim()) {
      alert('⚠️ Vui lòng dán văn bản câu hỏi từ PDF!');
      return;
    }
    if (!rawAnswerKey.trim()) {
      alert('⚠️ Vui lòng dán danh sách đáp án tương ứng!');
      return;
    }

    try {
      // Parse answers key
      const keysMap = {};
      const answerLines = rawAnswerKey.split(/\r?\n/);
      answerLines.forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
        parts.forEach(part => {
          const match = part.match(/^(\d+)\s*[\.\-\:\)\]]?\s*(.+)$/);
          if (match) {
            const qNum = parseInt(match[1]);
            const ans = match[2].trim();
            if (ans) keysMap[qNum] = ans;
          }
        });
      });

      if (Object.keys(keysMap).length === 0) {
        // Fallback for simple letters
        const cleanChars = rawAnswerKey.replace(/[^A-E]/gi, '');
        if (cleanChars.length > 0) {
          cleanChars.split('').forEach((char, idx) => {
            keysMap[idx + 1] = char.toUpperCase();
          });
        }
      }

      // Parse PDF Text
      const textLines = rawPdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsedQuestions = [];
      let currentQ = null;

      for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i];
        const qMatch = line.match(/^(\d+)[\.\-\:\)\s]/) || line.match(/^Câu\s*(\d+)[\.\-\:\s]/i) || line.match(/^Question\s*(\d+)[\.\-\:\s]/i);

        if (qMatch) {
          if (currentQ) parsedQuestions.push(currentQ);
          const qNum = parseInt(qMatch[1]);
          const cleanText = line
            .replace(/^(\d+)[\.\-\:\)\s]*/, '')
            .replace(/^Câu\s*(\d+)[\.\-\:\s]*/i, '')
            .replace(/^Question\s*(\d+)[\.\-\:\s]*/i, '')
            .trim();

          currentQ = {
            id: qNum,
            question: cleanText,
            optA: '', optB: '', optC: '', optD: '',
            correct: keysMap[qNum] || ''
          };
        } else if (currentQ) {
          const optMatch = line.match(/^[\(\[]?([A-E])[\)\]\.\-\s]\s*(.*)$/i);
          if (optMatch) {
            const letter = optMatch[1].toUpperCase();
            const text = optMatch[2].trim();
            if (letter === 'A') currentQ.optA = text;
            else if (letter === 'B') currentQ.optB = text;
            else if (letter === 'C') currentQ.optC = text;
            else if (letter === 'D') currentQ.optD = text;
          } else {
            if (!currentQ.optA) currentQ.question += ' ' + line;
            else if (currentQ.optD) currentQ.optD += ' ' + line;
            else if (currentQ.optC) currentQ.optC += ' ' + line;
            else if (currentQ.optB) currentQ.optB += ' ' + line;
            else if (currentQ.optA) currentQ.optA += ' ' + line;
          }
        }
      }

      if (currentQ) parsedQuestions.push(currentQ);

      const finalQuestions = parsedQuestions.map(q => {
        let options = [];
        if (q.optA) options.push(`A. ${q.optA}`);
        if (q.optB) options.push(`B. ${q.optB}`);
        if (q.optC) options.push(`C. ${q.optC}`);
        if (q.optD) options.push(`D. ${q.optD}`);

        const correctAns = q.correct || keysMap[q.id] || '';
        const cleanCorrect = correctAns.toUpperCase().trim();
        
        if (options.length === 0 && cleanCorrect) {
          if (cleanCorrect.includes("YES") || cleanCorrect.includes("NO")) {
            options = ["YES", "NO", "NOT GIVEN"];
          } else if (cleanCorrect.includes("TRUE") || cleanCorrect.includes("FALSE")) {
            options = ["TRUE", "FALSE", "NOT GIVEN"];
          } else if (cleanCorrect === "NOT GIVEN" || cleanCorrect === "NOTGIVEN") {
            options = ["YES", "NO", "NOT GIVEN"];
          }
        }

        return {
          id: q.id,
          question: q.question,
          options,
          correct: correctAns
        };
      });

      if (finalQuestions.length === 0) {
        alert('⚠️ Không nhận diện được câu hỏi nào từ PDF Text. Vui lòng kiểm tra lại định dạng!');
        return;
      }

      const generatedParts = [{
        part_code: isListening ? 'listening_section_1' : 'reading_passage_1',
        part_name: isListening ? 'Listening Part 1' : 'Reading Passage 1',
        part_title: examTitle || 'Đề thi đã chuyển đổi',
        part_content: `<div class="highlight-box"><h3>${examTitle || 'ĐỀ THI ĐÃ CHUYỂN ĐỔI'}</h3><p>Mời nhập bài viết hoặc transcript tại đây...</p></div>`,
        questions: finalQuestions
      }];

      setConvertedExam({
        title: examTitle || 'Đề thi trích xuất PDF',
        course_id: targetCourseId,
        duration: examDuration,
        type: examType,
        question_count: finalQuestions.length,
        test_parts: generatedParts,
        questions: []
      });

      setSuccessMessage(`🎉 Đã trích xuất thành công ${finalQuestions.length} câu hỏi và tự động gán đáp án chính xác!`);
      setErrorMessage('');
      setPreviewActive(true);
      setActivePartIdx(0);
      setStudentAnswers({});
    } catch (err) {
      console.error(err);
      setErrorMessage(`⚠️ Lỗi parser PDF Text: ${err.message}`);
    }
  };

  // Convert pasted Aiken Text
  const handleAikenConvert = () => {
    if (!rawAikenText.trim()) {
      alert('⚠️ Vui lòng dán nội dung Aiken thô!');
      return;
    }

    try {
      const lines = rawAikenText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsedQuestions = [];
      let currentQ = null;
      let optCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const answerMatch = line.match(/^ANSWER\s*:\s*([A-E])/i);

        if (answerMatch) {
          if (currentQ) {
            currentQ.correct = answerMatch[1].toUpperCase();
            parsedQuestions.push(currentQ);
            currentQ = null;
            optCount = 0;
          }
        } else {
          const optionMatch = line.match(/^([A-E])[\.\)]\s*(.*)$/i);
          if (optionMatch) {
            if (currentQ) {
              const letter = optionMatch[1].toUpperCase();
              const text = optionMatch[2].trim();
              if (letter === 'A') { currentQ.optA = text; optCount++; }
              else if (letter === 'B') { currentQ.optB = text; optCount++; }
              else if (letter === 'C') { currentQ.optC = text; optCount++; }
              else if (letter === 'D') { currentQ.optD = text; optCount++; }
            }
          } else {
            if (currentQ && optCount > 0) {
              parsedQuestions.push(currentQ);
            }
            currentQ = {
              id: parsedQuestions.length + 1,
              question: line.replace(/^\d+[\.\s\)]*\s*/, '').trim(),
              optA: '', optB: '', optC: '', optD: '',
              correct: 'A'
            };
            optCount = 0;
          }
        }
      }

      if (currentQ && optCount > 0) {
        parsedQuestions.push(currentQ);
      }

      const finalQuestions = parsedQuestions.map((q, idx) => ({
        id: idx + 1,
        question: q.question,
        options: [`A. ${q.optA}`, `B. ${q.optB}`, `C. ${q.optC}`, `D. ${q.optD}`],
        correct: q.correct
      }));

      if (finalQuestions.length === 0) {
        alert('⚠️ Không nhận dạng được cấu trúc câu hỏi Aiken hợp lệ.');
        return;
      }

      const generatedParts = [{
        part_code: isListening ? 'listening_section_1' : 'reading_passage_1',
        part_name: isListening ? 'Listening Section 1' : 'Reading Passage 1',
        part_title: examTitle || 'Đề thi Aiken',
        part_content: '<h3>Đọc hiểu đề thi và lựa chọn các câu hỏi tương ứng</h3>',
        questions: finalQuestions
      }];

      setConvertedExam({
        title: examTitle || 'Đề thi Aiken',
        course_id: targetCourseId,
        duration: examDuration,
        type: examType,
        question_count: finalQuestions.length,
        test_parts: generatedParts,
        questions: []
      });

      setSuccessMessage(`🎉 Convert thành công ${finalQuestions.length} câu hỏi trắc nghiệm Aiken!`);
      setErrorMessage('');
      setPreviewActive(true);
      setActivePartIdx(0);
      setStudentAnswers({});
    } catch (err) {
      console.error(err);
      setErrorMessage(`⚠️ Lỗi biên soạn Aiken: ${err.message}`);
    }
  };

  // Load mammoth from CDN dynamically
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

  // DOCX Parser: Parse answers key
  const parseAnswersKeyText = (text) => {
    const keysMap = {};
    if (!text) return keysMap;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    // We try to extract answers using multiple strategies
    lines.forEach(line => {
      // Strategy 1: Check if the line matches a single item like "1. YES"
      const singleMatch = line.match(/^(\d+)\s*[\.\-\:\)\]\/]?\s*(.+)$/i);
      if (singleMatch) {
        const qNum = parseInt(singleMatch[1]);
        const ans = singleMatch[2].trim();
        if (qNum >= 1 && qNum <= 45) {
          keysMap[qNum] = ans;
          return;
        }
      }

      // Strategy 2: Search for all question-answer pattern inline matches
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

    // Fallback: If we got very few answers, split by tabs or multiple spaces (for tables)
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

  // DOCX Parser: Extract passage title
  const extractPassageTitle = (elements, partNum) => {
    for (let i = 0; i < Math.min(elements.length, 5); i++) {
      const text = elements[i].textContent.trim();
      if (!text) continue;
      if (text.match(/READING PASSAGE/i)) continue;
      if (text.match(/You should spend/i)) continue;
      return text;
    }
    return `Reading Passage ${partNum}`;
  };

  // DOCX Parser: Parse questions inside questions section of passage
  const parsePassageQuestions = (elements, keysMap) => {
    const questions = [];
    let currentQuestion = null;
    const sharedOptions = [];
    let pendingInstruction = "";

    elements.forEach(el => {
      const originalText = el.textContent.trim();
      if (!originalText) return;

      // Split embedded options (A-K) that might be concatenated due to Word text box extracts
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
          pendingInstruction = ""; // reset
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

    // Post-processing merge: If the last question's specific options and sharedOptions form a contiguous sequence (e.g. A-E and F-K), merge them!
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

  // Convert uploaded Word (.docx) test and key files
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
      setErrorMessage("");
      setSuccessMessage("");

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

      const passageElements = [[], [], []];
      let currentPassageIdx = 0;

      bodyElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.match(/READING\s+PASSAGE\s+1/i)) {
          currentPassageIdx = 1;
        } else if (text.match(/READING\s+PASSAGE\s+2/i)) {
          currentPassageIdx = 2;
        } else if (text.match(/READING\s+PASSAGE\s+3/i)) {
          currentPassageIdx = 3;
        }

        if (currentPassageIdx > 0) {
          passageElements[currentPassageIdx - 1].push(el);
        }
      });

      // Validate passages split
      if (passageElements[0].length === 0 && passageElements[1].length === 0 && passageElements[2].length === 0) {
        throw new Error("Không tìm thấy các thẻ 'READING PASSAGE 1/2/3' để tách phần! Vui lòng kiểm tra tiêu đề các đoạn văn.");
      }

      const generatedParts = [];

      for (let pIdx = 0; pIdx < 3; pIdx++) {
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

        const title = extractPassageTitle(elements, partNum);

        if (questionsStartIdx !== -1) {
          const textElements = elements.slice(0, questionsStartIdx);
          const qElements = elements.slice(questionsStartIdx);

          // Build Passage HTML nicely
          passageContentHtml = `<h2>READING PASSAGE ${partNum}</h2>\n`;
          passageContentHtml += `<p>You should spend about 20 minutes on <strong>Questions ${partNum === 1 ? '1-13' : (partNum === 2 ? '14-27' : '28-40')}</strong> which are based on READING PASSAGE ${partNum} below.</p>\n\n`;
          passageContentHtml += `<div class="highlight-box" style="text-align: center; background-color: #f8fafc; border-left: 4px solid #001e40; padding: 1rem; margin: 1.5rem 0; border-radius: 0 0.75rem 0.75rem 0;">\n  <h3 style="margin-top: 0; font-size: 1.125rem; font-weight: 800; color: #001e40; text-transform: uppercase;">${title}</h3>\n</div>\n\n`;

          let titleFound = false;
          textElements.forEach(el => {
            const text = el.textContent.trim();
            if (text.match(/READING PASSAGE/i)) return;
            if (text.match(/You should spend/i)) return;
            if (text === title && !titleFound) {
              titleFound = true;
              return;
            }
            passageContentHtml += el.outerHTML + "\n";
          });

          // Parse questions with recursive element flattening to process child list items or nested elements
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

        generatedParts.push({
          part_code: `ielts_reading_passage${partNum}`,
          part_name: `Reading Passage ${partNum}`,
          part_title: title,
          part_content: passageContentHtml,
          questions: questionsList
        });
      }

      const totalQCount = generatedParts.reduce((acc, curr) => acc + curr.questions.length, 0);

      const guessedTitle = docxTestFile.name.replace(/\.[^/.]+$/, "").replace(/_test/i, "").replace(/_/g, ' ');
      const finalTitle = examTitle.trim() ? examTitle.trim() : guessedTitle;
      setExamTitle(finalTitle);
      setIsListening(false);
      setConvertedExam({
        title: finalTitle,
        course_id: targetCourseId,
        duration: 60,
        type: examType,
        question_count: totalQCount,
        test_parts: generatedParts,
        questions: []
      });

      setSuccessMessage(`🎉 Chuyển đổi thành công đề thi từ Word! Phân tích được ${generatedParts.length} Passage với tổng cộng ${totalQCount} Câu hỏi.`);
      setPreviewActive(true);
      setActivePartIdx(0);
      setStudentAnswers({});
    } catch (err) {
      console.error(err);
      setErrorMessage(`⚠️ Lỗi trích xuất và phân tích Word: ${err.message}`);
    } finally {
      setConvertingDocx(false);
    }
  };

  // Select simulated answer inside the previewer
  const selectPreviewAnswer = (qId, answer) => {
    setStudentAnswers(prev => ({
      ...prev,
      [qId]: answer
    }));
  };

  // Simulated question grid map clicks (jump and auto-scroll/highlight inside mock test preview)
  const handlePreviewMapClick = (partIndex, qId) => {
    setActivePartIdx(partIndex);
    setTimeout(() => {
      const card = document.getElementById(`preview-q-card-${qId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('border-indigo-650', 'ring-2', 'ring-indigo-100', 'shadow-md');
        setTimeout(() => {
          card.classList.remove('border-indigo-650', 'ring-2', 'ring-indigo-100', 'shadow-md');
        }, 1500);
      }
    }, 120);
  };

  // Submit test (mock evaluation)
  const handlePreviewSubmit = () => {
    if (!convertedExam) return;

    let allQuestions = [];
    convertedExam.test_parts.forEach(p => {
      allQuestions = [...allQuestions, ...p.questions];
    });

    let score = 0;
    allQuestions.forEach(q => {
      const selected = studentAnswers[q.id] ? studentAnswers[q.id].trim().toLowerCase() : '';
      const correctAns = q.correct ? q.correct.trim().toLowerCase() : '';
      const correctAnswersArray = correctAns.split('/').map(a => a.trim());

      if (correctAnswersArray.includes(selected)) {
        score++;
      }
    });

    alert(`🏆 [XEM TRƯỚC HỌC VIÊN] Kết quả làm bài giả lập:\n👉 Số câu đúng: ${score}/${allQuestions.length} câu\n👉 Độ chính xác: ${Math.round((score / allQuestions.length) * 100)}%\n👉 Thời gian thử: ${Math.floor(elapsedSeconds / 60)} phút ${elapsedSeconds % 60} giây`);
  };

  // Download converted JSON file
  const downloadJsonFile = () => {
    if (!convertedExam) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify([convertedExam], null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `${examTitle.replace(/\s+/g, '_') || 'IELTS_Mock_Test'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download Answers CSV file
  const downloadAnswersCsv = () => {
    if (!convertedExam) return;
    let allQuestions = [];
    convertedExam.test_parts.forEach(p => {
      allQuestions = [...allQuestions, ...p.questions];
    });

    const csvRows = ['Câu,Đáp án'];
    allQuestions.forEach(q => {
      csvRows.push(`${q.id},"${q.correct || ''}"`);
    });

    const csvString = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.setAttribute('href', url);
    anchor.setAttribute('download', `${examTitle.replace(/\s+/g, '_') || 'IELTS_Mock_Test'}_Answers.csv`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  // Publish exam details directly to Supabase db
  const publishToSupabase = async () => {
    if (!convertedExam) return;
    if (!examTitle.trim()) {
      alert('⚠️ Vui lòng đặt tiêu đề bài thi!');
      return;
    }

    try {
      setPublishing(true);
      
      const payload = {
        title: examTitle.trim(),
        course_id: targetCourseId,
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
        pdf_url: null,
        passage_text: null,
        created_by: user?.id || null
      };

      const { data, error } = await supabase
        .from('exams')
        .insert(payload)
        .select();

      if (error) throw error;

      alert(`🎉 THÀNH CÔNG! Đề thi "${examTitle.trim()}" đã được đăng tải và lưu trữ trực tuyến trực tiếp vào Supabase database thành công!`);
      navigate('/teacher');
    } catch (err) {
      console.error(err);
      alert(`⚠️ Không thể lưu lên Supabase: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  // Active preview structures details
  const activePart = convertedExam?.test_parts[activePartIdx];
  const activeQuestions = activePart?.questions || [];
  const totalQuestionsList = convertedExam 
    ? convertedExam.test_parts.reduce((acc, curr) => [...acc, ...curr.questions], [])
    : [];

  const formatStopwatch = () => {
    const min = Math.floor(elapsedSeconds / 60);
    const sec = elapsedSeconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#f8f9fa] min-h-screen text-slate-800 pb-20 selection:bg-indigo-900 selection:text-white Outfit">
      {/* Dynamic inline styles for premium Study4 Mock Exam Room previewer */}
      <style dangerouslySetInnerHTML={{ __html: `
        .study4-passage {
          font-family: 'Inter', system-ui, sans-serif;
          color: #334155;
          font-size: 0.9rem;
          line-height: 1.75;
        }
        .study4-passage h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #001e40;
          margin-bottom: 0.75rem;
          text-transform: uppercase;
        }
        .study4-passage h3 {
          font-size: 1.1rem;
          font-weight: 800;
          color: #001e40;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 4px;
        }
        .study4-passage p {
          margin-bottom: 1rem;
          text-align: justify;
        }
        .study4-passage table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 0.85rem;
        }
        .study4-passage th, .study4-passage td {
          border: 1px solid #cbd5e1;
          padding: 10px 14px;
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
          padding: 1.25rem;
          margin: 1.5rem 0;
          border-radius: 0 0.75rem 0.75rem 0;
        }
        .custom-preview-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
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
        }
        .highlighted-text {
          background-color: rgba(254, 240, 138, 0.6);
          border-radius: 3px;
          padding: 1px 3px;
        }
      `}} />

      {/* Header Banner */}
      <section className="bg-gradient-to-r from-[#001e40] to-[#002d62] text-white py-12 px-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-xs font-bold text-indigo-300 uppercase tracking-widest">
              Advanced Tools
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Bộ Convert Đề Thi & Preview Study4</h1>
            <p className="text-slate-300 text-xs md:text-sm">Chuyển đổi tài liệu IELTS từ nhiều định dạng và kiểm tra trực quan thời gian thực trước khi đăng tải.</p>
          </div>
          <button
            onClick={() => navigate('/teacher')}
            className="flex items-center gap-1.5 px-4 py-2 border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all active:scale-95 text-slate-200"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span> Cổng Giáo Viên
          </button>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 mt-8 space-y-8">
        {/* CONVERTER CONTROLS PANEL */}
        {!previewActive && (
          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h2 className="text-base font-extrabold text-[#001e40] flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-650">settings_suggest</span>
                  Tham Số Cấu Hình Đề Thi
                </h2>
                <p className="text-slate-400 text-[10px] mt-0.5">Vui lòng điền thông tin đề và chọn nguồn dữ liệu thô bên dưới.</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Meta information row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tiêu Đề Đề Thi</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Vd: IELTS Simulation Reading test 1"
                    className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3.5 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Khóa học Target</label>
                  <select
                    value={targetCourseId}
                    onChange={(e) => setTargetCourseId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3.5 focus:outline-none focus:border-indigo-600 bg-white font-semibold cursor-pointer"
                    disabled={coursesLoading}
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title} ({c.code.toUpperCase()})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Phân Loại Đề</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3.5 focus:outline-none focus:border-indigo-600 bg-white font-bold text-indigo-700 cursor-pointer"
                  >
                    <option value="test">Thi Thử Full Test (Tính giờ)</option>
                    <option value="homework">Lớp Bài Tập Ôn Luyện (Tự chọn)</option>
                  </select>
                </div>
              </div>

              {/* Extra row for details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-50">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Thời Gian Làm Bài (Phút)</label>
                  <input
                    type="number"
                    value={examDuration}
                    onChange={(e) => setExamDuration(parseInt(e.target.value) || 60)}
                    className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3.5 focus:outline-none focus:border-indigo-600 font-semibold"
                  />
                </div>

                <div className="space-y-2 col-span-2 flex flex-col justify-end pb-1.5 pl-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={isListening}
                      onChange={(e) => setIsListening(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4 cursor-pointer"
                    />
                    <span className="flex items-center gap-1 text-slate-650">
                      <span className="material-symbols-outlined text-sm font-bold text-indigo-650">headphones</span>
                      Đây là đề thi Nghe (Listening)
                    </span>
                  </label>
                  <p className="text-[9px] text-slate-400">Nếu bật, giao diện sẽ bổ sung bộ phát âm thanh Listening trực tuyến ở panel bên trái trong Mock Preview.</p>
                </div>
              </div>

              {/* INPUT TYPE SWAPPER TABS */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex gap-2 border-b border-slate-100 pb-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveInputTab('csv')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activeInputTab === 'csv' ? 'bg-[#001e40] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className="material-symbols-outlined text-xs">file_present</span>
                    Upload CSV Nháp (_Draft.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveInputTab('paste')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activeInputTab === 'paste' ? 'bg-[#001e40] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className="material-symbols-outlined text-xs">content_paste</span>
                    Dán Text PDF & Đáp Án
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveInputTab('aiken')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activeInputTab === 'aiken' ? 'bg-[#001e40] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className="material-symbols-outlined text-xs">quiz</span>
                    Dán Định Dạng Aiken thô
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveInputTab('docx')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activeInputTab === 'docx' ? 'bg-[#001e40] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className="material-symbols-outlined text-xs">description</span>
                    Upload File Word (.docx)
                  </button>
                </div>

                {/* TAB PANELS CONTAINER */}
                <div className="bg-slate-50/50 p-6 border border-slate-150 rounded-2xl">
                  {/* TAB 1: CSV UPLOADER */}
                  {activeInputTab === 'csv' && (
                    <div className="space-y-4 text-center">
                      <div className="max-w-md mx-auto py-8 px-4 border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-650">
                          <span className="material-symbols-outlined text-2xl font-bold">csv</span>
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-slate-700">Tải lên file bản nháp CSV của bạn</p>
                          <p className="text-[9px] text-slate-400 mt-1">Chấp nhận định dạng file có đuôi `_Draft.csv` do PDF Converter sinh ra.</p>
                        </div>
                        <label className="mt-2 flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow active:scale-95">
                          <span className="material-symbols-outlined text-sm font-bold">upload_file</span>
                          Chọn Tệp Nháp
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleCsvUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="text-left max-w-2xl mx-auto space-y-1 text-slate-500 text-[10px] bg-slate-100/60 p-4 rounded-xl border border-slate-200">
                        <span className="font-extrabold block text-slate-700 uppercase tracking-wide">💡 Cấu trúc cột yêu cầu trong CSV:</span>
                        <p>File nháp CSV của bạn cần có dòng tiêu đề cột chứa các thuộc tính sau:</p>
                        <code className="block font-mono bg-white border border-slate-200 p-2 rounded mt-1.5 text-indigo-750 break-all select-all">
                          Câu, Phần, Tiêu đề Phần, Đoạn văn/Nội dung (HTML), Câu hỏi, Lựa chọn A, Lựa chọn B, Lựa chọn C, Lựa chọn D, Lựa chọn E, Đáp án đúng
                        </code>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PDF TEXT & ANSWERS PASTE */}
                  {activeInputTab === 'paste' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            1. Dán văn bản câu hỏi thô từ PDF
                          </label>
                          <textarea
                            value={rawPdfText}
                            onChange={(e) => setRawPdfText(e.target.value)}
                            placeholder="Nhập hoặc dán chuỗi text từ PDF đề thi...&#10;Vd:&#10;1. What is the main cause of the Titanic disaster?&#10;A. High speed&#10;B. An iceberg hit&#10;C. Strong storm&#10;D. Machine failure"
                            rows={8}
                            className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-650 bg-white font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            2. Dán chuỗi đáp án (Key Answers Sheet)
                          </label>
                          <textarea
                            value={rawAnswerKey}
                            onChange={(e) => setRawAnswerKey(e.target.value)}
                            placeholder="Nhập hoặc dán bảng đáp án...&#10;Vd:&#10;1. B&#10;2. A&#10;3. D&#10;4. C&#10;Hoặc dán ngang: 1-A 2-B 3-D 4-C"
                            rows={8}
                            className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-650 bg-white font-mono"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePastePdfAndAnswersConvert}
                        className="w-full py-2.5 bg-gradient-to-r from-indigo-650 to-indigo-750 hover:from-indigo-750 hover:to-indigo-850 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-97 flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">build</span>
                        Chuyển Đổi & Preview Mock Đề Thi
                      </button>
                    </div>
                  )}

                  {/* TAB 3: AIKEN TEXT PASTE */}
                  {activeInputTab === 'aiken' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Dán đoạn văn định dạng Aiken thô
                        </label>
                        <textarea
                          value={rawAikenText}
                          onChange={(e) => setRawAikenText(e.target.value)}
                          placeholder="Dán mã Aiken tại đây...&#10;Vd:&#10;Đây là câu hỏi số 1?&#10;A. Lựa chọn số 1&#10;B. Lựa chọn số 2&#10;C. Lựa chọn số 3&#10;D. Lựa chọn số 4&#10;ANSWER: B"
                          rows={8}
                          className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-650 bg-white font-mono"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAikenConvert}
                        className="w-full py-2.5 bg-gradient-to-r from-indigo-650 to-indigo-750 hover:from-indigo-750 hover:to-indigo-850 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-97 flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">construction</span>
                        Chuyển Đổi & Preview Aiken
                      </button>
                    </div>
                  )}

                  {/* TAB 4: WORD DOCX UPLOADER */}
                  {activeInputTab === 'docx' && (
                    <div className="space-y-6 animate-fade-in text-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Box 1: READING TEST FILE */}
                        <div className="py-8 px-4 border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-700">
                            <span className="material-symbols-outlined text-2xl font-bold">article</span>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-extrabold text-slate-700">1. Tải lên File Đề Thi (.docx)</p>
                            <p className="text-[9px] text-slate-400 mt-1">Chọn file chứa 3 đoạn văn bài đọc và 40 câu hỏi.</p>
                          </div>
                          <label className="mt-2 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow active:scale-95">
                            <span className="material-symbols-outlined text-sm font-bold">upload_file</span>
                            <span>{docxTestFile ? docxTestFile.name : 'Chọn File Đề'}</span>
                            <input
                              type="file"
                              accept=".docx"
                              onChange={(e) => setDocxTestFile(e.target.files[0])}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Box 2: ANSWER KEY FILE */}
                        <div className="py-8 px-4 border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <span className="material-symbols-outlined text-2xl font-bold">key</span>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-extrabold text-slate-700">2. Tải lên File Đáp Án (.docx)</p>
                            <p className="text-[9px] text-slate-400 mt-1">Chọn file chứa bảng đáp án từ câu 1 đến 40.</p>
                          </div>
                          <label className="mt-2 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow active:scale-95">
                            <span className="material-symbols-outlined text-sm font-bold">upload_file</span>
                            <span>{docxKeyFile ? docxKeyFile.name : 'Chọn File Đáp Án'}</span>
                            <input
                              type="file"
                              accept=".docx"
                              onChange={(e) => setDocxKeyFile(e.target.files[0])}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="pt-4 pb-2">
                        <button
                          type="button"
                          onClick={handleDocxConvert}
                          disabled={convertingDocx}
                          className="w-full py-3.5 bg-[#001e40] hover:bg-[#003366] text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-97 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">analytics</span>
                          {convertingDocx ? 'Đang phân tích tài liệu...' : 'Phân Tích & Chuyển Đổi Đề Word (.docx)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ERROR AND SUCCESS HINTS */}
        {successMessage && !previewActive && (
          <div className="p-4 border border-emerald-250 bg-emerald-50 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-emerald-650 text-base">check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 border border-red-200 bg-red-50 rounded-2xl text-xs font-semibold text-red-700 flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-red-500 text-base">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* HIGH-FIDELITY STUDY4 LIVE MOCK PREVIEW SUITE */}
        {previewActive && convertedExam && (
          <section className="fixed inset-0 bg-[#f8f9fa] z-50 overflow-hidden animate-fade-in flex flex-col w-screen h-screen">
            {/* Simulated Study4 Top Bar Header */}
            <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex justify-between items-center px-6">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-base font-bold">preview</span>
                </span>
                <div>
                  <h1 className="font-extrabold text-sm text-[#001e40]">{examTitle || 'Đề thi trích xuất'}</h1>
                  <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest block">
                    Mock Test Viewer (Study4 Simulator Mode)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (window.confirm('🗑️ Bạn có thực sự muốn đóng màn hình preview để sửa đổi lại cấu hình nhập không?')) {
                      setPreviewActive(false);
                      setConvertedExam(null);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-[10px] font-extrabold transition-all border border-red-200 flex items-center gap-1 active:scale-95"
                >
                  <span className="material-symbols-outlined text-xs font-bold">close</span>
                  Thoát Preview
                </button>
              </div>
            </header>

            {/* Study4 Sub-bar with highlight control & tab parts */}
            <div className="bg-[#f8fafc] border-b border-slate-200 shrink-0 px-6 py-2.5 flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-1.5 select-none shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highlightEnabled}
                    onChange={(e) => setHighlightEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
                </label>
                <span className="text-[10px] font-bold text-slate-650 uppercase tracking-wide flex items-center gap-1">
                  Highlight nội dung
                  <span className="material-symbols-outlined text-xs text-slate-400" title="Bật để kích hoạt màu highlight trên văn bản bài đọc">info</span>
                </span>
              </div>

              {/* Tabs Swapper for sections */}
              <div className="flex overflow-x-auto gap-1 max-w-full custom-preview-scrollbar py-0.5 pr-2 shrink-0">
                {convertedExam.test_parts.map((part, idx) => (
                  <button
                    key={part.part_code}
                    onClick={() => setActivePartIdx(idx)}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-extrabold shrink-0 transition-all ${activePartIdx === idx ? 'bg-[#001e40] text-white shadow-sm font-extrabold' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    {part.part_name}
                  </button>
                ))}
              </div>
            </div>

            {/* SPLIT SCREEN WORKSPACE */}
            <main className="flex-grow flex flex-col lg:flex-row gap-6 p-6 overflow-hidden min-h-0 bg-[#f8f9fa]">
              {/* COLUMN 1: PASSAGE OR AUDIO VIEWER (Left) */}
              <div className="flex-grow bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col lg:h-full relative overflow-hidden min-w-0">
                {/* Listening Audio player if flagged */}
                {isListening && (
                  <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 shadow-sm space-y-2.5 mb-4 shrink-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-750 text-base font-bold">headphones</span>
                        <span className="text-[10px] font-extrabold text-[#001e40] uppercase tracking-wider">
                          Audio: {activePart?.part_name || 'Phần nghe IELTS'}
                        </span>
                      </div>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                    {/* Simulated Player for demonstration */}
                    <div className="flex items-center gap-3 bg-white border border-indigo-150 p-2 rounded-xl">
                      <button className="w-8 h-8 rounded-full bg-indigo-650 text-white flex items-center justify-center shadow hover:bg-indigo-750 transition-all active:scale-95 shrink-0">
                        <span className="material-symbols-outlined text-sm font-bold">play_arrow</span>
                      </button>
                      <div className="flex-grow bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
                        <div className="bg-indigo-650 h-full w-1/4"></div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 font-mono">00:00 / 30:00</span>
                      <span className="material-symbols-outlined text-sm text-slate-400 cursor-pointer">volume_up</span>
                    </div>
                  </div>
                )}

                {/* Main scrollable content view */}
                <div className="flex-grow overflow-y-auto pr-2 custom-preview-scrollbar min-h-0">
                  {activePart?.part_content ? (
                    <div
                      className={`study4-passage select-text ${highlightEnabled ? 'has-highlights' : ''}`}
                      dangerouslySetInnerHTML={{
                        __html: highlightEnabled 
                          ? activePart.part_content.replace(/(A\.\s|B\.\s|C\.\s|D\.\s|Paragraph [A-G])/g, '<span class="highlighted-text">$1</span>')
                          : activePart.part_content
                      }}
                    />
                  ) : (
                    <div className="text-center py-20 text-slate-400 text-xs">
                      <span className="material-symbols-outlined text-3xl block mb-2 text-slate-350">menu_book</span>
                      Không có văn bản bài đọc cho phần này.
                    </div>
                  )}
                </div>
              </div>

              {/* COLUMN 2: INTERACTIVE BUBBLE SHEET / QUESTIONS LIST (Middle) */}
              <div className="w-full lg:w-[35%] shrink-0 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col lg:h-full overflow-hidden min-w-0">
                <div className="border-b border-slate-150 pb-3 mb-3 shrink-0 flex justify-between items-center">
                  <h3 className="font-extrabold text-xs text-[#001e40] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-650 text-base">fact_check</span>
                    <span>Phiếu Trả Lời Đề Thi</span>
                  </h3>
                  <span className="text-[9px] font-extrabold text-[#001e40] bg-slate-100 px-2.5 py-1 rounded-full">
                    {Object.keys(studentAnswers).filter(k => activeQuestions.some(q => q.id === parseInt(k) || q.id === k)).length} / {activeQuestions.length} câu
                  </span>
                </div>

                {/* Scrollable list of questions */}
                <div className="flex-grow overflow-y-auto pr-1 space-y-4 custom-preview-scrollbar text-xs min-h-0">
                  {(() => {
                    let lastInstruction = "";
                    return activeQuestions.map((q, idx) => {
                      const selectedOpt = studentAnswers[q.id];
                      const correctAns = q.correct ? q.correct.trim() : '';
                      const hasOptions = q.options && q.options.length > 0;
                      const { instruction, questionText } = parseQuestionInstruction(q);
                      
                      const showInstruction = instruction && instruction !== lastInstruction;
                      if (showInstruction) {
                        lastInstruction = instruction;
                      }
                      
                      return (
                        <React.Fragment key={q.id}>
                          {showInstruction && (
                            <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-4 mb-3 text-slate-700 leading-relaxed font-semibold text-[11px] whitespace-pre-line shadow-sm border-l-4 border-l-indigo-650 animate-fade-in">
                              <span className="material-symbols-outlined text-[12px] text-indigo-650 mr-1.5 align-middle font-bold">info</span>
                              {instruction}
                            </div>
                          )}
                          <div
                            id={`preview-q-card-${q.id}`}
                            className="flex flex-col py-3.5 px-4 border border-slate-100 rounded-2xl gap-3 transition-all bg-white shadow-sm hover:shadow-md border-l-2 hover:border-l-indigo-600"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-[#001e40]/10 text-[#001e40] font-extrabold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                                {q.id}
                              </span>
                              <p className="font-semibold text-slate-800 leading-relaxed flex-grow whitespace-pre-line text-[11px]">
                                {questionText.startsWith('Câu') ? questionText : `Câu ${q.id}: ${questionText}`}
                              </p>
                            </div>

                            {hasOptions ? (
                              <div className="w-full pt-1">
                                {(() => {
                                  const isYesNoNotGiven = q.options.length > 0 && q.options.every(opt => {
                                    const u = opt.trim().toUpperCase();
                                    return u === 'YES' || u === 'NO' || u === 'NOT GIVEN' || u === 'TRUE' || u === 'FALSE';
                                  });

                                  if (isYesNoNotGiven) {
                                    return (
                                      <div className="flex flex-wrap gap-1.5 shrink-0">
                                        {q.options.map(opt => {
                                          const val = opt.trim();
                                          const isSelected = selectedOpt === val;
                                          return (
                                            <button
                                              key={val}
                                              onClick={() => selectPreviewAnswer(q.id, val)}
                                              className={`px-3 py-1 rounded-lg font-extrabold text-[9px] flex items-center justify-center transition-all border ${isSelected ? 'bg-[#001e40] border-[#001e40] text-white shadow-sm scale-105' : 'border-slate-200 text-slate-450 hover:border-[#001e40] hover:text-[#001e40] hover:bg-slate-50'}`}
                                            >
                                              {val}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="w-full flex flex-col gap-1.5">
                                      {q.options.map((opt) => {
                                        const optMatch = opt.trim().match(/^([A-K])[\.\-\)\s\u00A0]*\s*(.*)$/i);
                                        const letter = optMatch ? optMatch[1].toUpperCase() : '';
                                        const description = optMatch ? optMatch[2].trim() : opt.trim();
                                        const isSelected = selectedOpt === letter;
                                        
                                        return (
                                          <div
                                            key={opt}
                                            onClick={() => selectPreviewAnswer(q.id, letter || opt)}
                                            className={`flex items-start gap-2.5 p-2 rounded-xl border text-[10px] cursor-pointer transition-all hover:bg-slate-50/80 active:scale-[0.99] ${isSelected ? 'bg-indigo-50/40 border-indigo-500 text-indigo-950 font-bold shadow-sm' : 'border-slate-100 text-slate-600'}`}
                                          >
                                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border text-[9px] font-extrabold transition-all ${isSelected ? 'bg-[#001e40] border-[#001e40] text-white shadow-sm' : 'border-slate-250 text-slate-500 bg-white'}`}>
                                              {letter}
                                            </span>
                                            <span className="leading-relaxed pt-0.5">{description}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={studentAnswers[q.id] || ''}
                                onChange={(e) => selectPreviewAnswer(q.id, e.target.value)}
                                placeholder="Nhập kết quả điền từ..."
                                className="w-full border border-slate-200 focus:border-[#001e40] focus:ring-1 focus:ring-[#001e40] rounded-xl px-3 py-1.5 text-[10px] font-semibold focus:outline-none bg-white text-slate-800 transition-colors shadow-sm"
                              />
                            )}
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()}

                  {activeQuestions.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-[10px]">
                      Không có câu hỏi cho phần này.
                    </div>
                  )}
                </div>
              </div>

              {/* COLUMN 3: STICKY CONTROL & NAVIGATION SIDEBAR (Right) */}
              <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4 lg:h-full overflow-hidden">
                {/* Timer card */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-center items-center shadow-sm shrink-0 gap-2">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">Thời gian xem trước</span>
                  <span className="font-bold text-2xl font-mono text-[#001e40]">{formatStopwatch()}</span>
                  
                  <button
                    onClick={handlePreviewSubmit}
                    className="w-full bg-[#001e40] hover:bg-[#003366] text-white font-extrabold text-[10px] py-3 rounded-xl transition-all shadow active:scale-97 flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">check_circle</span> NỘP BÀI THỬ
                  </button>
                </div>

                {/* Entire Interactive Question Sidebar navigation map */}
                <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col shadow-sm flex-grow min-h-0 overflow-hidden">
                  <span className="block text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mb-2 pb-2 border-b border-slate-100 shrink-0">
                    Bản Đồ Câu Hỏi Toàn Bài
                  </span>
                  <div className="flex-grow overflow-y-auto pr-1 custom-preview-scrollbar space-y-3.5 min-h-0">
                    {convertedExam.test_parts.map((part, pIdx) => {
                      if (!part.questions || part.questions.length === 0) return null;
                      return (
                        <div key={part.part_code} className="space-y-1.5">
                          <h4 className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider">
                            {part.part_name}
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {part.questions.map((q) => {
                              const isAnswered = !!studentAnswers[q.id];
                              const isActive = activePartIdx === pIdx;
                              return (
                                <button
                                  key={q.id}
                                  onClick={() => handlePreviewMapClick(pIdx, q.id)}
                                  className={`w-8 h-8 font-extrabold text-[10px] flex items-center justify-center rounded-lg transition-all border shrink-0 ${isAnswered ? 'bg-[#001e40] border-[#001e40] text-white shadow-sm' : isActive ? 'border-[#001e40] text-[#001e40] bg-indigo-50/50' : 'border-slate-200 text-slate-440 hover:border-[#001e40] hover:text-[#001e40]'}`}
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
            </main>
          </section>
        )}

        {/* SYSTEM JSON AND ACTION PANEL - FOR EXPORTS */}
        {previewActive && convertedExam && (
          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden p-6 animate-fade-in space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#001e40]">Thao Tác Đóng Gói & Xuất Bản</h3>
              <p className="text-slate-400 text-[10px] mt-0.5">Vui lòng rà soát lại giao diện kỹ càng ở trên, sau đó chọn hành động lưu trữ phù hợp.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={downloadJsonFile}
                className="py-3 bg-white border border-slate-250 hover:border-indigo-600 text-slate-700 hover:text-indigo-600 rounded-2xl text-xs font-bold transition-all active:scale-97 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Tải Đề Thi JSON (Supabase)
              </button>

              <button
                type="button"
                onClick={downloadAnswersCsv}
                className="py-3 bg-white border border-slate-250 hover:border-indigo-600 text-slate-700 hover:text-indigo-600 rounded-2xl text-xs font-bold transition-all active:scale-97 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">assignment</span>
                Tải Đáp Án CSV
              </button>

              <button
                type="button"
                onClick={publishToSupabase}
                disabled={publishing}
                className="py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-850 text-white rounded-2xl text-xs font-bold transition-all active:scale-97 flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="material-symbols-outlined text-sm font-bold">cloud_upload</span>
                {publishing ? 'Đang xuất bản...' : 'Đăng Trực Tiếp Lên Supabase'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default IeltsConverter;
