@echo off
echo ====================================
echo BFExpress IA Service - Démarrage
echo ====================================
echo.

REM Vérifier si l'environnement virtuel existe
if not exist "venv" (
    echo Création de l'environnement virtuel...
    python -m venv venv
    echo.
)

REM Activer l'environnement virtuel
echo Activation de l'environnement virtuel...
call venv\Scripts\activate
echo.

REM Installer les dépendances
echo Installation des dépendances...
pip install -r requirements.txt
echo.

REM Vérifier si .env existe
if not exist ".env" (
    echo Création du fichier .env...
    copy .env.example .env
    echo.
    echo IMPORTANT: Editez le fichier .env pour configurer:
    echo - Azure OpenAI (recommandé) OU
    echo - Hugging Face (local/gratuit)
    echo.
    pause
)

REM Démarrer le service
echo Démarrage du service IA sur http://localhost:8000
echo.
echo Documentation disponible sur: http://localhost:8000/docs
echo.
echo Appuyez sur Ctrl+C pour arrêter
echo.
python -m app.main