/**
 * CẤU HÌNH KẾT NỐI SUPABASE
 * 
 * Hướng dẫn lấy thông tin:
 * 1. Truy cập vào dashboard.supabase.com và chọn dự án của bạn.
 * 2. Vào mục Project Settings (icon răng cưa) -> API.
 * 3. Copy "Project API keys" -> "anon public" dán vào SUPABASE_ANON_KEY.
 * 4. Copy "Project URL" dán vào SUPABASE_URL.
 */

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Khởi tạo Supabase client toàn cục
let supabase = null;

if (typeof window.supabase !== 'undefined') {
    if (SUPABASE_URL && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn("Supabase chưa được cấu hình. Vui lòng cập nhật SUPABASE_URL và SUPABASE_ANON_KEY trong file js/config.js!");
    }
} else {
    console.error("Không tìm thấy Supabase JS SDK. Vui lòng đảm bảo đã nhúng thư viện Supabase CDN!");
}
