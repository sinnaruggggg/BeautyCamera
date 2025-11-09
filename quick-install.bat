@echo off
echo ========================================
echo 뷰티 카메라 - 자동 설치 스크립트
echo ========================================
echo.

echo [1/4] Node.js 버전 확인...
node --version
if %errorlevel% neq 0 (
    echo 오류: Node.js가 설치되지 않았습니다!
    echo https://nodejs.org 에서 다운로드하세요.
    pause
    exit /b 1
)

echo.
echo [2/4] 패키지 설치 중...
call npm install
if %errorlevel% neq 0 (
    echo 오류: 패키지 설치 실패!
    pause
    exit /b 1
)

echo.
echo [3/4] Android 기기 확인...
adb devices
if %errorlevel% neq 0 (
    echo 경고: adb를 찾을 수 없습니다.
    echo Android Studio와 환경 변수를 확인하세요.
)

echo.
echo [4/4] 설치 완료!
echo.
echo ========================================
echo 다음 단계:
echo 1. USB로 휴대폰 연결
echo 2. 'npm run android' 실행
echo ========================================
echo.

pause
