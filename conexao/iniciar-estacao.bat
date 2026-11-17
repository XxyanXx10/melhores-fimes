@echo off
REM Abre a estacao de render (PC de casa). Deixe esta janela aberta.
REM Se a estacao cair por qualquer motivo, ela volta sozinha em 10 segundos.
cd /d "%~dp0.."
title Estacao de render - deixe esta janela aberta

if not exist node_modules (
  echo Instalando dependencias pela primeira vez... isso demora alguns minutos.
  call npm install || goto :erro
)
if not exist conexao\config.json (
  echo Criando a senha da conexao...
  node conexao\configurar.mjs || goto :erro
)

REM o painel (http://localhost:5181) abre junto; com --rede da para ver do celular pelo Tailscale
start "Painel da conexao" /min node conexao\painel.mjs --rede

:de_novo
node conexao\estacao.mjs
echo.
echo A estacao fechou. Abrindo de novo em 10 segundos (feche a janela para parar)...
timeout /t 10 /nobreak >nul
goto :de_novo

:erro
echo.
echo Algo deu errado acima. Tire um print desta janela.
pause
