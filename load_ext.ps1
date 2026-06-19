# WebMonitor Pro - 加载扩展到Chrome
# 以管理员身份运行 ? 不需要，但有窗口不显示的问题，用下面方式

$extPath = "D:\360Downloads\WebMonitorPro-Init"

# 方案1: 启动一个新的Chrome窗口（带扩展）
Write-Output "启动Chrome并加载扩展: $extPath"
Start-Process "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" `
    -ArgumentList "--load-extension=`"$extPath`"", "--new-window", "chrome-extension://$(Get-ItemPropertyValue -Path "$extPath\manifest.json" -Name name 2>$null)/src/options/options.html"

Write-Output "完成！Chrome已启动并加载扩展"
Write-Output "如果Chrome已经在运行，会打开新窗口"
pause
