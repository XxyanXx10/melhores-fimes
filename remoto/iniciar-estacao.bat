@echo off
REM Abre a estacao de render (PC de casa). Deixe esta janela aberta.
REM Se a estacao cair por qualquer motivo, ela volta sozinha em 10 segundos.
cd /d "%~dp0.."
title Estacao de render - deixe esta janela aberta

if not exist node_modules (
  echo Instalando dependencias pela primeira vez... isso demora alguns minutos.
  call npm install || goto :erro
)
if not exist remoto\config.json (
  echo Criando a senha da conexao...
  node remoto\configurar.mjs || goto :erro
)

:de_novo
node remoto\estacao.mjs
echo.
echo A estacao fechou. Abrindo de novo em 10 segundos (feche a janela para parar)...
timeout /t 10 /nobreak >nul
goto :de_novo

:erro
echo.
echo Algo deu errado acima. Tire um print desta janela.
pause
