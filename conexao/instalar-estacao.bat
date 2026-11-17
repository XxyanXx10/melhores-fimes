@echo off
REM Rode UMA VEZ no PC de casa, com botao direito > "Executar como administrador".
REM 1. libera as portas 5180 (estacao) e 5181 (painel) no Firewall SO para a rede do Tailscale
REM 2. faz a estacao abrir sozinha quando o Windows liga (janela minimizada)
REM Para desfazer: instalar-estacao.bat remover
cd /d "%~dp0"

set "REGRA=Estacao de render (Tailscale)"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%STARTUP%\Estacao de render.lnk"

net session >nul 2>&1
if errorlevel 1 (
  echo Precisa ser como administrador: botao direito neste arquivo ^> Executar como administrador.
  pause
  exit /b 1
)

if /I "%~1"=="remover" (
  netsh advfirewall firewall delete rule name="%REGRA%" >nul
  if exist "%ATALHO%" del "%ATALHO%"
  echo Desfeito: porta fechada e a estacao nao abre mais sozinha.
  pause
  exit /b 0
)

netsh advfirewall firewall delete rule name="%REGRA%" >nul 2>&1
netsh advfirewall firewall add rule name="%REGRA%" dir=in action=allow protocol=TCP localport=5180,5181 remoteip=100.64.0.0/10 profile=any
if errorlevel 1 (
  echo Nao consegui criar a regra do firewall.
) else (
  echo Firewall: portas 5180 e 5181 liberadas so para aparelhos do seu Tailscale.
)

powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%ATALHO%');" ^
  "$s.TargetPath='%~dp0iniciar-estacao.bat';" ^
  "$s.WorkingDirectory='%~dp0..';" ^
  "$s.WindowStyle=7;" ^
  "$s.Description='Estacao de render';" ^
  "$s.Save()"
if exist "%ATALHO%" echo Inicializacao: a estacao abre sozinha (minimizada) quando o Windows ligar.

echo.
echo Pronto. Abrindo a estacao agora...
start "" /min "%~dp0iniciar-estacao.bat"
pause
