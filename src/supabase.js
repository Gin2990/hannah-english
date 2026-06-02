import { createClient } from '@supabase/supabase-js';

// Đọc cấu hình từ biến môi trường Vite hoặc cấu hình toàn cục tĩnh
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof window !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_URL !== 'YOUR_SUPABASE_URL' ? window.SUPABASE_URL : 'https://your-supabase-url.supabase.co');
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY && window.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' ? window.SUPABASE_ANON_KEY : 'your-anon-key');

// Xử lý loại bỏ dấu ngoặc kép bọc ngoài nếu người dùng nhập trong file .env
if (typeof supabaseUrl === 'string') {
  supabaseUrl = supabaseUrl.trim().replace(/^["']|["']$/g, '');
}
if (typeof supabaseAnonKey === 'string') {
  supabaseAnonKey = supabaseAnonKey.trim().replace(/^["']|["']$/g, '');
}

console.log("Initializing Supabase Client with URL:", supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (supabaseUrl === 'https://your-supabase-url.supabase.co' || !supabaseUrl) {
  console.warn("🔔 Supabase chưa được cấu hình. Vui lòng tạo file .env ở thư mục gốc hoặc cập nhật cấu hình trong src/supabase.js!");
}

