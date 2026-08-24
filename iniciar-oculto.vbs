' Inicia a plataforma sem abrir janela nenhuma.
' Usado pelo atalho de inicializacao do Windows.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta
sh.Run "cmd /c npm start", 0, False
