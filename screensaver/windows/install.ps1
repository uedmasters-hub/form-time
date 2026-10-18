# Installs the FORM / TIME screensaver for this Windows user (no administrator
# rights needed) and opens Screen Saver Settings with it selected.
$ErrorActionPreference = 'Stop'

$source = $PSScriptRoot
$target = Join-Path $env:LOCALAPPDATA 'Programs\FORM TIME Screensaver'
$scr = Join-Path $target 'FORM TIME.scr'
$desktop = 'HKCU:\Control Panel\Desktop'

if (-not (Test-Path (Join-Path $source 'FORM TIME.scr'))) {
  throw 'Run this from the extracted "FORM TIME Screensaver" folder (not from inside the zip).'
}

# A running copy (the screensaver, its preview or its options) holds the files.
# Matched by folder: the FORM / TIME desktop app has a similar name and is left alone.
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and ($_.Path -like "$target\*" -or $_.Path -like "$source\*") } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300

if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Path $target -Force | Out-Null
Get-ChildItem $source | Where-Object { $_.Name -notin 'install.cmd', 'install.ps1' } |
  Copy-Item -Destination $target -Recurse
# Downloaded files carry "from the internet"; these are ours now.
Get-ChildItem $target -Recurse -File | Unblock-File

# Windows keeps the chosen screensaver's path; an 8.3 short path avoids the space.
$path = $scr
try {
  $short = (New-Object -ComObject Scripting.FileSystemObject).GetFile($scr).ShortPath
  if ($short -and ($short -notmatch ' ')) { $path = $short }
} catch { }

Set-ItemProperty -Path $desktop -Name 'SCRNSAVE.EXE' -Value $path
Set-ItemProperty -Path $desktop -Name 'ScreenSaveActive' -Value '1'
$timeout = (Get-ItemProperty -Path $desktop -Name 'ScreenSaveTimeOut' -ErrorAction SilentlyContinue).ScreenSaveTimeOut
if (-not $timeout -or [int]$timeout -le 0) {
  Set-ItemProperty -Path $desktop -Name 'ScreenSaveTimeOut' -Value '600' # 10 minutes
}

Write-Host ''
Write-Host "FORM / TIME screensaver installed in $target" -ForegroundColor Green
Write-Host 'Screen Saver Settings is opening: choose Settings... for the clock''s look, Preview to try it.'
Start-Process 'control.exe' -ArgumentList 'desk.cpl,,@screensaver'
