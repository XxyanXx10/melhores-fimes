@echo off
REM Abre o painel da conexao no navegador (http://localhost:5181).
REM Pode fechar esta janela depois: o painel continua aberto em segundo plano.
cd /d "%~dp0.."
start "Painel da conexao" /min node conexao\painel.mjs --abrir
