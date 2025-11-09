@echo off
chcp 65001 >nul
echo ============================================
echo 🎨 BeautyCamera APK 자동 빌드 스크립트
echo ============================================
echo.

:: Node.js 확인
echo [1/4] Node.js 확인 중...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js가 설치되어 있지 않습니다.
    echo 👉 https://nodejs.org 에서 설치 후 다시 실행하세요.
    pause
    exit /b 1
)
echo ✅ Node.js 설치 확인

:: Java 확인
echo.
echo [2/4] Java 확인 중...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Java가 설치되어 있지 않습니다.
    echo 👉 JDK 17을 설치해주세요.
    echo    https://adoptium.net/
    pause
    exit /b 1
)
echo ✅ Java 설치 확인

:: 패키지 설치
echo.
echo [3/4] 패키지 설치 중...
echo 이 작업은 5-10분 정도 걸릴 수 있습니다.
call npm install
if %errorlevel% neq 0 (
    echo ❌ 패키지 설치 실패
    pause
    exit /b 1
)
echo ✅ 패키지 설치 완료

:: APK 빌드
echo.
echo [4/4] APK 빌드 중...
echo 이 작업은 5-15분 정도 걸릴 수 있습니다.
cd android
call gradlew.bat assembleRelease
if %errorlevel% neq 0 (
    echo ❌ APK 빌드 실패
    echo.
    echo 문제 해결:
    echo 1. Android Studio가 설치되어 있는지 확인
    echo 2. ANDROID_HOME 환경변수 설정 확인
    echo 3. 설치가이드.md 참고
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ============================================
echo 🎉 APK 빌드 완료!
echo ============================================
echo.
echo 📂 APK 파일 위치:
echo android\app\build\outputs\apk\release\app-release.apk
echo.
echo 📱 설치 방법:
echo 1. 휴대폰을 USB로 연결
echo 2. adb install android\app\build\outputs\apk\release\app-release.apk
echo    또는 APK 파일을 직접 휴대폰으로 복사하여 설치
echo.

:: APK 파일 복사 (편의를 위해)
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    copy "android\app\build\outputs\apk\release\app-release.apk" "BeautyCamera.apk" >nul
    echo 💡 편의를 위해 프로젝트 폴더에 'BeautyCamera.apk'로 복사했습니다.
    echo.
)

echo 완료되었습니다! 아무 키나 눌러 종료...
pause >nul
