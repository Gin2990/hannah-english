-- =========================================================================
-- KHỐI LỆNH CẬP NHẬT DATABASE HỆ THỐNG HANNAH ENGLISH & EDUMETRICS
-- PHỤC VỤ PHÂN TÁCH BÀI TẬP (PRACTICE) & ĐỀ FULL TEST CHUẨN STUDY4
-- =========================================================================
-- Hướng dẫn: Copy toàn bộ nội dung file này dán vào Supabase -> SQL Editor 
-- rồi nhấn "Run" để cập nhật cấu trúc dữ liệu mới.
-- =========================================================================

-- 1. Xóa toàn bộ dữ liệu lịch sử thi cũ và đề thi cũ (theo yêu cầu dọn dẹp sạch)
DELETE FROM public.exam_results;
DELETE FROM public.exams;

-- 2. Bổ sung các cột mới vào bảng public.exams nếu chưa tồn tại
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS part_code TEXT DEFAULT NULL; -- Lưu mã Part (Vd: 'toeic_part1')
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS allowed_durations INTEGER[] DEFAULT '{}'; -- Mảng các thời gian cho phép (Vd: {10, 15, 20, 25})
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS test_parts JSONB DEFAULT '[]'::jsonb; -- Lưu trữ đề thi thử dạng tabs nhiều phần
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT NULL; -- Đường dẫn tệp đề thi dạng PDF
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS passage_text TEXT DEFAULT NULL; -- Lưu nội dung văn bản đề bài / bài đọc (Study4 style)


