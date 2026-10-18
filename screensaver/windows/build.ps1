# Builds the FORM / TIME screensaver for Windows.
#
#   powershell -ExecutionPolicy Bypass -File screensaver\windows\build.ps1
#
# Needs Node.js 20+ (with the repo's npm packages installed: npm ci) and the
# .NET SDK 8 or later. Produces, in screensaver\build:
#   FORM TIME Screensaver\            the folder install.cmd copies into place
#   FORM-TIME-Screensaver-Windows.zip the same folder, zipped, to share
param(
  # Reuse screensaver\build\web from an earlier run instead of exporting again.
  [switch]$SkipWeb
)
$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot
$root = (Resolve-Path (Join-Path $here '..\..')).Path
$build = Join-Path $here '..\build'
$web = Join-Path $build 'web'
$bin = Join-Path $build 'windows-bin'
$out = Join-Path $build 'FORM TIME Screensaver'
$zip = Join-Path $build 'FORM-TIME-Screensaver-Windows.zip'

$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
Write-Host "FORM / TIME screensaver $version for Windows"

if (-not $SkipWeb) {
  node (Join-Path $here '..\scripts\build-web.mjs') $web
  if ($LASTEXITCODE -ne 0) { throw 'The web export failed.' }
}
if (-not (Test-Path (Join-Path $web 'screensaver.html'))) { throw "No web export in $web." }

if (Test-Path $bin) { Remove-Item $bin -Recurse -Force }
dotnet build (Join-Path $here 'FormTimeScreensaver.csproj') -c Release -nologo "-p:Version=$version" -o $bin
if ($LASTEXITCODE -ne 0) { throw 'The build failed.' }

# The folder: the .scr (a renamed .exe), WebView2's DLLs, the web app, the installer.
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null
Copy-Item (Join-Path $bin 'FormTimeScreensaver.exe') (Join-Path $out 'FORM TIME.scr')
if (Test-Path (Join-Path $bin 'FormTimeScreensaver.exe.config')) {
  Copy-Item (Join-Path $bin 'FormTimeScreensaver.exe.config') (Join-Path $out 'FORM TIME.scr.config')
}
Get-ChildItem $bin -Filter '*.dll' | Copy-Item -Destination $out
# WebView2Loader.dll may sit in a runtimes\ folder; the .scr finds it beside itself.
$loader = Get-ChildItem $bin -Recurse -Filter 'WebView2Loader.dll' |
  Where-Object { $_.FullName -match 'x64' -or $_.DirectoryName -eq (Resolve-Path $bin).Path } |
  Select-Object -First 1
if (-not $loader) { throw 'WebView2Loader.dll is missing from the build.' }
if (-not (Test-Path (Join-Path $out 'WebView2Loader.dll'))) { Copy-Item $loader.FullName $out }
Copy-Item $web (Join-Path $out 'web') -Recurse
foreach ($f in 'install.cmd', 'install.ps1', 'uninstall.cmd', 'uninstall.ps1', 'README.txt') {
  Copy-Item (Join-Path $here $f) $out
}

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $out -DestinationPath $zip
Write-Host "Built: $out"
Write-Host "Zip:   $zip"
