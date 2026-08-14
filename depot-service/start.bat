@echo off
echo 🚀 Démarrage du Microservice Dépôts BFExpress...
echo.
echo 📍 Service: http://localhost:8087
echo 🌡️ Health check: http://localhost:8087/health
echo.
echo Installation des dépendances...
call npm install
echo.
echo Démarrage du service...
call npm start
pause