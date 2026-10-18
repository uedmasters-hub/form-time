# CI check for the Windows screensaver, on a Windows runner: installs it,
# checks the registry and files, runs it full screen (/s) and its options
# (/c) and saves screenshots, then uninstalls it.
param([string]$Folder, [string]$Out)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Out | Out-Null
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Shot($name) {
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save((Join-Path $Out "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  # How much of the screen isn't the corner's colour: the clock really drew.
  $corner = $bmp.GetPixel(4, 4); $drawn = 0; $total = 0
  for ($y = 0; $y -lt $bmp.Height; $y += 12) {
    for ($x = 0; $x -lt $bmp.Width; $x += 12) {
      $c = $bmp.GetPixel($x, $y)
      if ([Math]::Abs($c.R - $corner.R) + [Math]::Abs($c.G - $corner.G) + [Math]::Abs($c.B - $corner.B) -gt 20) { $drawn++ }
      $total++
    }
  }
  $share = [Math]::Round(100.0 * $drawn / $total, 1)
  Write-Host "::notice::$name screenshot $($b.Width)x$($b.Height), corner $($corner.R),$($corner.G),$($corner.B), drawn $share%"
  $script:lastShare = $share
  $g.Dispose(); $bmp.Dispose()
  Write-Host "screenshot $name ($($b.Width)x$($b.Height))"
}

$failures = 0
# Windows runs a screensaver directly with its arguments. (Start-Process would
# go through the shell, which runs every .scr as "/S" and drops the rest.)
function Run($exe, [string]$arguments) {
  $info = New-Object System.Diagnostics.ProcessStartInfo $exe, $arguments
  $info.UseShellExecute = $false
  return [System.Diagnostics.Process]::Start($info)
}
function Expect($ok, $what) {
  if ($ok) { Write-Host "ok   $what" } else { Write-Host "::error::FAIL $what"; $script:failures++ }
}

Write-Host "WebView2: $((Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue).pv)"

& (Join-Path $Folder 'install.ps1')
Get-Process control, SystemSettings, rundll32 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$target = Join-Path $env:LOCALAPPDATA 'Programs\FORM TIME Screensaver'
$scr = Join-Path $target 'FORM TIME.scr'
$saved = (Get-ItemProperty 'HKCU:\Control Panel\Desktop').'SCRNSAVE.EXE'
Expect (Test-Path $scr) 'installed the .scr'
Expect (Test-Path (Join-Path $target 'web\screensaver.html')) 'installed the web app'
Expect (Test-Path (Join-Path $target 'WebView2Loader.dll')) 'installed WebView2Loader.dll'
Expect ((Get-Item -LiteralPath $saved).FullName -eq (Get-Item -LiteralPath $scr).FullName) "chose it in the registry ($saved)"
Expect ((Get-ItemProperty 'HKCU:\Control Panel\Desktop').ScreenSaveActive -eq '1') 'turned the screensaver on'

# Options, as Windows' Settings... button would open them.
$c = Run $scr '/c'
Start-Sleep -Seconds 10
Expect (-not $c.HasExited) 'options dialog stays open'
$c.Refresh(); Expect ($c.MainWindowTitle -eq 'FORM / TIME Screensaver') "it is the options dialog ('$($c.MainWindowTitle)')"
Shot 'windows-options'
if (-not $c.HasExited) { $c | Stop-Process -Force }

# The preview: inside another window (here a stand-in for Screen Saver
# Settings' little monitor), and gone when that window closes.
$host_ = New-Object System.Windows.Forms.Form
$host_.Text = 'Preview host'; $host_.StartPosition = 'Manual'; $host_.Location = New-Object System.Drawing.Point 40, 40
$host_.ClientSize = New-Object System.Drawing.Size 304, 190
$host_.Show(); [System.Windows.Forms.Application]::DoEvents()
$pv = Run $scr "/p $($host_.Handle.ToInt64())"
for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 250; [System.Windows.Forms.Application]::DoEvents() }
Expect (-not $pv.HasExited) '/p keeps running inside its window'
Shot 'windows-preview'
$hostHandle = $host_.Handle
$host_.Close(); $host_.Dispose()
Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern bool IsWindow(System.IntPtr h);'
Write-Host "::notice::preview host window still exists after Close: $([W.U]::IsWindow($hostHandle))"
for ($i = 0; $i -lt 24 -and -not $pv.HasExited; $i++) { Start-Sleep -Milliseconds 250; [System.Windows.Forms.Application]::DoEvents() }
Expect $pv.HasExited '/p closes when its window goes'
if (-not $pv.HasExited) { Write-Host "::notice::preview process responding: $($pv.Responding)" }
if (-not $pv.HasExited) { $pv | Stop-Process -Force }

# Night, digital, then the default look, full screen.
New-Item -Path 'HKCU:\Software\FORM TIME\Screensaver' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\FORM TIME\Screensaver' -Name Face -Value 'digital'
Set-ItemProperty -Path 'HKCU:\Software\FORM TIME\Screensaver' -Name Appearance -Value 'night'
foreach ($look in 'digital-night', 'analog-default') {
  if ($look -eq 'analog-default') { Remove-Item 'HKCU:\Software\FORM TIME\Screensaver' -Recurse }
  $p = Run $scr '/s'
  Start-Sleep -Seconds 12
  Expect (-not $p.HasExited) "/s keeps running ($look)"
  Shot "windows-$look"
  Expect ($script:lastShare -gt 1) "the clock drew something ($look)"
  if (-not $p.HasExited) { $p | Stop-Process -Force }
  Start-Sleep -Seconds 1
}

# Moving the pointer closes it.
$p = Run $scr '/s'
Start-Sleep -Seconds 6
$pos = [System.Windows.Forms.Cursor]::Position
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ($pos.X + 200), ($pos.Y + 120)
Start-Sleep -Seconds 2
Expect $p.HasExited 'closes when the mouse moves'
if (-not $p.HasExited) { $p | Stop-Process -Force }

# So does a key (it reaches the page, which tells the screensaver).
$p = Run $scr '/s'
Start-Sleep -Seconds 6
[System.Windows.Forms.SendKeys]::SendWait('a')
for ($i = 0; $i -lt 12 -and -not $p.HasExited; $i++) { Start-Sleep -Milliseconds 250 }
Expect $p.HasExited 'closes when a key is pressed'
if (-not $p.HasExited) { $p | Stop-Process -Force }

& (Join-Path $target 'uninstall.ps1')
Expect (-not (Test-Path $target)) 'uninstall removed the files'
Expect (-not (Get-ItemProperty 'HKCU:\Control Panel\Desktop' -Name 'SCRNSAVE.EXE' -ErrorAction SilentlyContinue)) 'uninstall cleared the choice'

if ($failures -gt 0) { throw "$failures check(s) failed" }
Write-Host '::notice::PASS'
