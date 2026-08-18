@echo off
echo ========================================
echo Demarrage de tous les services BFExpress
echo ========================================
echo.

echo [1/4] Demarrage du service depot-service...
start "Depot Service" cmd /k "cd depot-service && node server.js"

echo [2/4] Demarrage du service tracking-service...
start "Tracking Service" cmd /k "cd tracking-service && node server.js"

echo [3/4] Demarrage du service livreurs-service...
start "Livreurs Service" cmd /k "cd livreurs-service && node server.js"

echo [4/4] Demarrage du service vehicles-service...
start "Vehicles Service" cmd /k "cd vehicles-service && node server.js"

echo.
echo ========================================
echo Tous les services sont en cours de demarrage
echo ========================================
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause