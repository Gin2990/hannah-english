-- =========================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU HANNAH ENGLISH & EDUMETRICS (SUPABASE POSTGRESQL)
-- =========================================================================
-- Hướng dẫn: Copy toàn bộ nội dung file này dán vào Supabase -> SQL Editor 
-- rồi nhấn "Run" để khởi tạo cấu trúc dữ liệu online.
-- =========================================================================

-- 1. BẢNG THÔNG TIN TÀI KHOẢN (PROFILES)
-- Bảng này liên kết trực tiếp với bảng auth.users quản lý tài khoản của Supabase.
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    full_name text,
    role text default 'student' check (role in ('student', 'teacher', 'admin')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bật tính năng Row Level Security (RLS) để tăng độ bảo mật
alter table public.profiles enable row level security;

-- Tạo hàm kiểm tra Admin bảo mật (Chạy với quyền hệ thống, tránh lỗi đệ quy chính sách RLS)
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Tạo Policy cho bảng profiles
create policy "Cho phép xem thông tin hồ sơ công khai" on public.profiles
    for select using (true);

create policy "Người dùng tự cập nhật hồ sơ của chính mình" on public.profiles
    for update using (auth.uid() = id);

create policy "Cho phép Admin chỉnh sửa mọi hồ sơ" on public.profiles
    for all using (public.is_admin());


-- 2. BẢNG KHÓA HỌC (COURSES)
create table public.courses (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    code text unique not null, -- 'toeic', 'ielts', 'cambridge'
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.courses enable row level security;

create policy "Tất cả mọi người đều có thể xem khóa học" on public.courses
    for select using (true);

create policy "Chỉ Admin mới có quyền thêm/sửa khóa học" on public.courses
    for all using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'admin'
        )
    );


-- 3. BẢNG PHÂN QUYỀN KHÓA HỌC CHO HỌC VIÊN (STUDENT_COURSES)
create table public.student_courses (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.profiles(id) on delete cascade not null,
    course_id uuid references public.courses(id) on delete cascade not null,
    assigned_at timestamp with time zone default timezone('utc'::text, now()),
    unique (student_id, course_id)
);

alter table public.student_courses enable row level security;

create policy "Cho phép người dùng xem phân quyền của chính mình" on public.student_courses
    for select using (auth.uid() = student_id or exists (
        select 1 from public.profiles 
        where id = auth.uid() and role in ('teacher', 'admin')
    ));

create policy "Chỉ Admin mới có quyền phân quyền khóa học" on public.student_courses
    for all using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'admin'
        )
    );


-- 4. BẢNG ĐỀ THI & BÀI TẬP (EXAMS)
create table public.exams (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    course_id uuid references public.courses(id) on delete cascade not null,
    duration integer not null default 120, -- Thời gian làm bài (phút)
    type text default 'test' check (type in ('homework', 'test')), -- Phân loại: 'homework' (Bài tập rèn luyện) hoặc 'test' (Bài thi thử tính giờ)
    part_code text default null, -- Phân loại Part cụ thể cho Bài tập (Vd: 'toeic_part1')
    allowed_durations integer[] default '{}', -- Các giới hạn thời gian tự chọn cho Bài tập (Vd: {10, 15, 20})
    test_parts jsonb default '[]'::jsonb, -- Lưu cấu trúc các phần của đề thi thử Full Test Study4
    question_count integer not null default 0,
    questions jsonb not null default '[]'::jsonb, -- Mảng JSON chứa câu hỏi (chỉ dùng cho bài tập thường)
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.exams enable row level security;

create policy "Cho phép tất cả mọi người đọc danh sách đề thi" on public.exams
    for select using (true);

create policy "Cho phép Giảng viên và Admin thêm/sửa đề thi" on public.exams
    for all using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role in ('teacher', 'admin')
        )
    );


-- 5. BẢNG LƯU TRỮ KẾT QUẢ THI (EXAM_RESULTS)
create table public.exam_results (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.profiles(id) on delete cascade not null,
    exam_id uuid references public.exams(id) on delete cascade not null,
    score integer not null, -- Điểm số (ví dụ: số câu đúng)
    total_questions integer not null, -- Tổng số câu hỏi trong bài
    duration_seconds integer not null, -- Thời gian làm bài thực tế (giây)
    answers jsonb not null default '{}'::jsonb, -- Lưu các đáp án học viên chọn
    taken_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.exam_results enable row level security;

create policy "Học viên xem kết quả của chính mình" on public.exam_results
    for select using (auth.uid() = student_id or exists (
        select 1 from public.profiles 
        where id = auth.uid() and role in ('teacher', 'admin')
    ));

create policy "Học viên tự thêm kết quả thi sau khi làm bài xong" on public.exam_results
    for insert with check (auth.uid() = student_id);


-- =========================================================================
-- 6. TRIGGER TỰ ĐỘNG ĐỒNG BỘ TÀI KHOẢN TỪ AUTH.USERS SANG PUBLIC.PROFILES
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Thành viên mới'),
    'student' -- Vai trò mặc định là student
  );
  return new;
end;
$$ language plpgsql security definer;

-- Tạo trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =========================================================================
-- 7. KHỞI TẠO DỮ LIỆU MẪU CƠ BẢN (SEED DATA)
-- =========================================================================

-- Thêm 3 khóa học cốt lõi
insert into public.courses (title, code, description) values
('IELTS Masterclass', 'ielts', 'Chương trình ôn luyện thi IELTS học thuật 4 kỹ năng chuyên sâu.'),
('TOEIC 800+ Target', 'toeic', 'Lộ trình bứt phá điểm số TOEIC Listening & Reading, từ vựng thương mại.'),
('Cambridge Exams Hub', 'cambridge', 'Ôn luyện chứng chỉ quốc tế Cambridge cấp độ A2 Key (KET) và B1 Preliminary (PET).')
on conflict (code) do nothing;
