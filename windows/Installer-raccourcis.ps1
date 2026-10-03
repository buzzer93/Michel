[CmdletBinding()]
param([switch]$NoDesktop)
# "Michel" shortcuts (Desktop and Start menu): one double-click starts Michel if needed and opens the dashboard, with
# no window ("conhost --headless"). The shortcut runs the launcher from this folder, so it always uses the current
# version; the icon is copied to the Windows profile so it shows even while WSL is stopped.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Michel.ps1'
if (-not (Test-Path -LiteralPath $launcher)) { throw "Michel.ps1 introuvable." }
$iconDir = Join-Path $env:LOCALAPPDATA 'Michel'
[void][System.IO.Directory]::CreateDirectory($iconDir)
$icon = Join-Path $iconDir 'michel.ico'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'assets\michel.ico') -Destination $icon -Force
$shell = New-Object -ComObject WScript.Shell
$folders = @((Join-Path ([Environment]::GetFolderPath('Programs')) 'Michel'))
if (-not $NoDesktop) { $folders += [Environment]::GetFolderPath('Desktop') }
foreach ($folder in $folders) {
    [void][System.IO.Directory]::CreateDirectory($folder)
    $path = Join-Path $folder 'Michel.lnk'
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = "$env:WINDIR\System32\conhost.exe"
    $shortcut.Arguments = '--headless "{0}" -NoProfile -ExecutionPolicy Bypass -File "{1}"' -f "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe", $launcher
    $shortcut.WorkingDirectory = $env:USERPROFILE
    $shortcut.Description = 'Demarrer Michel et ouvrir son interface'
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Save()
    Write-Output "Raccourci cree : $path"
}
