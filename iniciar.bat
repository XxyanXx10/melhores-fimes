@echo off
REM Abre a plataforma. Uma janela so.
cd /d "%~dp0"
title Melhores Fimes - deixe esta janela aberta

if not exist node_modules (
  echo Instalando dependencias pela primeira vez... isso demora alguns minutos.
  call npm install || goto :erro
)

if not exist server\config.json (
  echo.
  echo ================================================================
  echo  FALTA UM ARQUIVO: server\config.json
  echo.
  echo  Copie server\config.example.json para server\config.json
  echo  e ajuste os caminhos do whisper-cli.exe e do modelo.
  echo ================================================================
  echo.
  pause
  exit /b 1
)

echo.
echo Preparando a plataforma... (demora um pouco na primeira vez)
call npm run build || goto :erro

REM so abre o navegador depois que a plataforma esta pronta para servir:
REM abrindo antes, o Chrome mostrava "conexao recusada" e parecia defeito
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:5175"

echo.
echo Pronto. O navegador vai abrir em http://localhost:5175
echo Feche esta janela para encerrar.
echo.
node server\index.mjs
exit /b 0

:erro
echo.
echo Algo deu errado acima. Tire um print desta janela.
pause
