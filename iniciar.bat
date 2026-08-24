@echo off
REM Abre a plataforma e o servico de transcricao em duas janelas.
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

start "Transcricao (whisper.cpp)" cmd /k npm run transcricao
start "Plataforma" cmd /k npm run dev
echo.
echo Duas janelas foram abertas. A plataforma abre em http://localhost:5173
echo Feche as duas janelas para encerrar.
exit /b 0

:erro
echo Falha ao instalar as dependencias.
pause
