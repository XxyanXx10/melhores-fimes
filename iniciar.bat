@echo off
REM Abre a plataforma. Uma janela so.
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install || goto :erro
)

if not exist server\config.json (
  echo.
  echo ATENCAO: falta o arquivo server\config.json
  echo Copie server\config.example.json para server\config.json
  echo e ajuste os caminhos do whisper-cli.exe e do modelo.
  echo.
  pause
  exit /b 1
)

start "" http://localhost:5175
call npm start
exit /b 0

:erro
echo Falha ao instalar as dependencias.
pause
