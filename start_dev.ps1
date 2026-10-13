# start_dev.ps1 — Starts Horizon backend + frontend in two terminal windows
# Run from the project root: .\start_dev.ps1

Write-Host "🚀 Starting Horizon AI Voice Agent..." -ForegroundColor Cyan

# Start FastAPI backend in a new terminal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host 'Starting Horizon Backend...' -ForegroundColor Green; .\.venv\Scripts\Activate.ps1 2>$null; python main.py" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Vite frontend dev server
Write-Host "🌐 Starting frontend dev server..." -ForegroundColor Cyan
npm run dev
