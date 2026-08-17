@echo off
echo ==========================================
echo   B3 WEBSITE - FIREBASE DEPLOY
echo ==========================================
echo.
echo 1. Dang nhap Firebase...
firebase login
echo.
echo 2. Chon Firebase project cua ban...
firebase use --add
echo.
echo 3. Deploy Hosting...
firebase deploy --only hosting
echo.
echo Xong. Mo URL Firebase trong ket qua ben tren.
pause
