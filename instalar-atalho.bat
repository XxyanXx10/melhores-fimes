@echo off
REM Faz a plataforma iniciar junto com o Windows, sem janela.
cd /d "%~dp0"

set "ALVO=%~dp0iniciar-oculto.vbs"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%STARTUP%\Melhores Fimes.lnk"

if /I "%~1"=="remover" (
  if exist "%ATALHO%" del "%ATALHO%" && echo Atalho removido.
  if not exist "%ATALHO%" echo A plataforma nao inicia mais junto com o Windows.
  pause
  exit /b 0
)

powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%ATALHO%');" ^
  "$s.TargetPath='wscript.exe';" ^
  "$s.Arguments='\"%ALVO%\"';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.Description='Melhores Fimes';" ^
  "$s.Save()"

if exist "%ATALHO%" (
  echo.
  echo Pronto. A plataforma passa a iniciar junto com o Windows, sem janela.
  echo Acesse por http://localhost:5175
  echo.
  echo Para desfazer: instalar-atalho.bat remover
) else (
  echo Nao foi possivel criar o atalho.
)
pause
