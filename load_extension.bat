@echo off
echo ============================================
echo   WebMonitor Pro - 一键加载Chrome扩展
echo ============================================
echo.

:: 关闭所有Chrome（可选）
choice /M "先关闭所有Chrome再重新打开"
if errorlevel 2 goto :skip_close
taskkill /f /im chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul
:skip_close

:: 加载扩展启动Chrome
set EXT_PATH=D:\360Downloads\WebMonitorPro-Init
echo 正在启动Chrome并加载扩展...
start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --load-extension="%EXT_PATH%" --new-window

echo.
echo ✅ Chrome已启动！加载完成后：
echo    1. 右上角扩展图标点击 WebMonitor Pro
echo    2. 右键图标 → 「选项」打开配置页面
echo    3. chrome://extensions 查看详情
echo.
pause
