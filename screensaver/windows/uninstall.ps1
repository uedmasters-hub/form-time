# Removes the FORM / TIME screensaver for this Windows user.
$ErrorActionPreference = 'Stop'

$target = Join-Path $env:LOCALAPPDATA 'Programs\FORM TIME Screensaver'
$desktop = 'HKCU:\Control Panel\Desktop'

Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and $_.Path -like "$target\*" } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300

# Only if it's still the chosen screensaver: then no screensaver is chosen.
$current = (Get-ItemProperty -Path $desktop -Name 'SCRNSAVE.EXE' -ErrorAction SilentlyContinue).'SCRNSAVE.EXE'
if ($current) {
  $long = $current
  try { $long = (Get-Item -LiteralPath $current -ErrorAction Stop).FullName } catch { }
  if ($long -like "$target*" -or $current -like '*FORM TIME.scr' -or $current -like '*FORMTI~1.SCR') {
    Remove-ItemProperty -Path $desktop -Name 'SCRNSAVE.EXE' -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $desktop -Name 'ScreenSaveActive' -Value '0'
  }
}

# Leave this script's own folder before removing it.
Set-Location $env:TEMP
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Remove-Item 'HKCU:\Software\FORM TIME\Screensaver' -Recurse -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:LOCALAPPDATA 'FORM TIME\Screensaver') -Recurse -Force -ErrorAction SilentlyContinue

Write-Host 'FORM / TIME screensaver removed.' -ForegroundColor Green
