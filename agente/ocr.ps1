# OCR de imagens com o leitor de texto do próprio Windows (sem instalar nada).
#   powershell -NoProfile -ExecutionPolicy Bypass -File agente/ocr.ps1 <pasta_com_png> <saida.jsonl> [idioma]
# Grava uma linha JSON por imagem: {"arquivo": "...", "texto": "..."}
param([string]$Pasta, [string]$Saida, [string]$Idioma = 'pt-BR')
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Esperar($op, [Type]$tipo) {
  $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result
}
$lang = New-Object Windows.Globalization.Language($Idioma)
$motor = $null; try { $motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang) } catch {}
if (-not $motor) { $motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
$linhas = New-Object System.Collections.Generic.List[string]
Get-ChildItem -Path (Join-Path $Pasta "*") -Include *.png,*.jpg | Sort-Object Name | ForEach-Object {
  $arq = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync($_.FullName)) ([Windows.Storage.StorageFile])
  $fluxo = Esperar ($arq.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $dec = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($fluxo)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bmp = Esperar ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $res = Esperar ($motor.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
  $texto = ($res.Lines | ForEach-Object { $_.Text }) -join "`n"
  $linhas.Add((@{ arquivo = $_.Name; texto = $texto } | ConvertTo-Json -Compress))
  $fluxo.Dispose()
}
[System.IO.File]::WriteAllLines($Saida, $linhas, (New-Object System.Text.UTF8Encoding $false))
