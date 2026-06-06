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

-- 3. Cập nhật RLS Policy của bảng student_courses để cho phép Giảng viên phân quyền học viên
DROP POLICY IF EXISTS "Chỉ Admin mới có quyền phân quyền khóa học" ON public.student_courses;
DROP POLICY IF EXISTS "Admin và Giảng viên có quyền phân quyền khóa học" ON public.student_courses;
CREATE POLICY "Admin và Giảng viên có quyền phân quyền khóa học" ON public.student_courses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'teacher')
        )
    );

-- =========================================================================
-- 4. Bảng public.classes (Quản lý lớp học của các khóa học)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tất cả mọi người dùng đăng nhập đều xem được lớp học" ON public.classes;
CREATE POLICY "Tất cả mọi người dùng đăng nhập đều xem được lớp học" ON public.classes
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin và Giảng viên quản lý lớp học" ON public.classes;
CREATE POLICY "Admin và Giảng viên quản lý lớp học" ON public.classes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'teacher')
        )
    );

-- =========================================================================
-- 5. Bổ sung cột class_id vào profiles để gán học viên vào lớp
-- =========================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- Policy cho phép Giảng viên cập nhật class_id của học viên
DROP POLICY IF EXISTS "Giáo viên và Admin được cập nhật thông tin profiles học viên" ON public.profiles;
CREATE POLICY "Giáo viên và Admin được cập nhật thông tin profiles học viên" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'teacher')
        )
    );

-- =========================================================================
-- 6. Bảng public.assignments (Quản lý giao bài tập)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE DEFAULT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT NULL,
    due_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Xem bài tập được giao" ON public.assignments;
CREATE POLICY "Xem bài tập được giao" ON public.assignments
    FOR SELECT USING (
        -- Giảng viên và Admin được xem tất cả
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'teacher')
        )
        OR 
        -- Học viên xem bài tập giao trực tiếp cho mình
        auth.uid() = student_id
        OR
        -- Học viên xem bài tập giao cho lớp mình đang học
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND class_id = assignments.class_id
        )
    );

DROP POLICY IF EXISTS "Giáo viên và Admin quản lý bài giao" ON public.assignments;
CREATE POLICY "Giáo viên và Admin quản lý bài giao" ON public.assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'teacher')
        )
    );




