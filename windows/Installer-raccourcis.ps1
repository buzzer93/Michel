[CmdletBinding()]
param([switch]$NoDesktop)
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Michel.ps1'
if (-not (Test-Path -LiteralPath $launcher)) { throw "Michel.ps1 introuvable." }
$shell = New-Object -ComObject WScript.Shell
$folders = @((Join-Path ([Environment]::GetFolderPath('Programs')) 'Michel'))
if (-not $NoDesktop) { $folders += [Environment]::GetFolderPath('Desktop') }
foreach ($folder in $folders) {
    [void][System.IO.Directory]::CreateDirectory($folder)
    $path = Join-Path $folder 'Michel.lnk'
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = '-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $launcher
    $shortcut.WorkingDirectory = Split-Path $PSScriptRoot -Parent
    $shortcut.Description = 'Demarrer, ouvrir et arreter Michel'
    $iconPath = Join-Path $PSScriptRoot 'assets\michel.ico'
    $shortcut.IconLocation = if (Test-Path -LiteralPath $iconPath) { "$iconPath,0" } else { "$env:WINDIR\System32\imageres.dll,109" }
    $shortcut.Save()
    Write-Output "Raccourci cree : $path"
}
