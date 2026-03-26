@echo off
REM Build script for Personal Note App - Electron standalone application

echo =========================================
echo Personal Note App - Electron Build
echo =========================================

REM Step 1: Install dependencies
echo.
echo [Step 1] Installing dependencies...
call npm install
if errorlevel 1 (
    echo Failed to install dependencies
    exit /b 1
)

REM Step 2: Compile Electron TypeScript
echo.
echo [Step 2] Compiling Electron TypeScript...
call npx tsc -p tsconfig.electron.json
if errorlevel 1 (
    echo Failed to compile Electron TypeScript
    exit /b 1
)

REM Step 3: Build React app with Vite
echo.
echo [Step 3] Building React app with Vite...
call npm run build
if errorlevel 1 (
    echo Failed to build React app
    exit /b 1
)

REM Step 4: Build Electron app
echo.
echo [Step 4] Building Electron application for Windows...
call npm run build:electron:win
if errorlevel 1 (
    echo Failed to build Electron app
    exit /b 1
)

echo.
echo =========================================
echo Build completed successfully!
echo =========================================
echo.
echo Output location: .\dist-app
echo.
echo To run the app locally:
echo   npm run dev:electron
echo.
pause
