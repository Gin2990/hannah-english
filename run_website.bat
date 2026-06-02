@echo off
title Hannah English & EduMetrics - Trình khởi chạy hệ thống React SPA
color 0B
chcp 65001 >nul

echo =========================================================================
echo       HỆ THỐNG TRÌNH KHỞI CHẠY WEB LOCAL - HANNAH ENGLISH & EDUMETRICS
echo =========================================================================
echo.
echo Đang kiểm tra môi trường chạy React Vite SPA...

:: 1. Kiểm tra Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [LỖI] Không tìm thấy môi trường Node.js trên máy tính của bạn!
    echo Vui lòng cài đặt Node.js từ: https://nodejs.org/ trước khi tiếp tục.
    echo.
    pause
    exit
)

echo [OK] Tìm thấy môi trường Node.js.

:: 2. Kiểm tra và cài đặt node_modules nếu thiếu
if not exist "node_modules\" (
    echo [THÔNG BÁO] Không tìm thấy thư mục node_modules.
    echo Đang tự động tải các gói phụ trợ cần thiết (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [LỖI] Cài đặt dependencies thất bại! Vui lòng kiểm tra lại kết nối mạng.
        pause
        exit
    )
)

:: 3. Khởi động Vite Dev Server
echo.
echo Đang kích hoạt máy chủ React Local (npm run dev)...
echo Trình duyệt của bạn sẽ tự động mở trang web ở địa chỉ: http://localhost:5173
echo.
echo =========================================================================
echo  [LƯU Ý] Vui lòng giữ cửa sổ terminal này chạy để duy trì trang web.
echo  Khi muốn tắt trang web, hãy đóng cửa sổ này hoặc nhấn Ctrl + C.
echo =========================================================================
echo.

:: Mở trình duyệt trước
timeout /t 2 >nul
start http://localhost:5173

:: Chạy server React ở luồng chính
call npm run dev

pause
