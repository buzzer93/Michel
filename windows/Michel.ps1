[CmdletBinding()]
param(
    # Open (default): start the services if needed, then open the dashboard once it is ready. No window: the shortcut
    # runs this script through "conhost --headless"; only an error is shown. Stopping is done from the dashboard.
    [ValidateSet('Open', 'Status')]
    [string]$Action = 'Open',
    [ValidatePattern('^[a-zA-Z0-9_.-]+$')]
    [string]$Distribution = 'Ubuntu',
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$script:MichelUrl = 'http://localhost:8480'
$script:Units = @('michel-ollama', 'openclaw-gateway', 'michel-stt', 'michel-stt-precise', 'michel-tts', 'michel-tts-st', 'michel-web')
$script:LogPath = Join-Path $env:LOCALAPPDATA 'Michel\launcher.log'

# The launcher has no window: this log is the only trace of what it did. Never fails the launch.
function Write-MichelLog {
    param([string]$Message)
    try {
        [void][System.IO.Directory]::CreateDirectory((Split-Path $script:LogPath))
        if ((Test-Path -LiteralPath $script:LogPath) -and (Get-Item -LiteralPath $script:LogPath).Length -gt 256KB) {
            Remove-Item -LiteralPath $script:LogPath
        }
        Add-Content -LiteralPath $script:LogPath -Value ('{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}' -f (Get-Date), $PID, $Message)
    } catch { }
}

function Get-MichelHealth {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8480/healthz' -TimeoutSec 3
        return [pscustomobject]@{ Running = [bool]$health.ok; Gateway = [bool]$health.gateway; Url = $script:MichelUrl }
    } catch {
        return [pscustomobject]@{ Running = $false; Gateway = $false; Url = $script:MichelUrl }
    }
}

function Invoke-MichelSystemctl {
    param([string[]]$Arguments)
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = "$env:WINDIR\System32\wsl.exe"
    $info.Arguments = '-d {0} -u root -- systemctl {1}' -f $Distribution, ($Arguments -join ' ')
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(120000)) {
            $process.Kill()
            throw "Ubuntu ne repond pas apres deux minutes."
        }
        $output = $stdout.GetAwaiter().GetResult()
        $errors = $stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            throw ("La commande a echoue dans Ubuntu.", $output, $errors -join [Environment]::NewLine)
        }
        return $output.Trim()
    } finally {
        $process.Dispose()
    }
}

# WSL stops Ubuntu about 15 s after the last Windows program attached to it exits; systemd services do not count, so
# Michel died during the wait when nothing else (VS Code, a terminal) was open. This hidden wsl.exe stays attached
# while michel-web runs and exits by itself once Michel is stopped from the dashboard, letting WSL go idle as before.
function Start-MichelKeepAlive {
    $marker = 'michel-keepalive'
    if (Get-CimInstance Win32_Process -Filter "Name='wsl.exe'" | Where-Object { $_.CommandLine -match $marker }) { return }
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = "$env:WINDIR\System32\wsl.exe"
    $info.Arguments = '-d {0} --exec sh -c ": {1}; while ! systemctl show -p ActiveState --value michel-web | grep -qxE ''inactive|failed''; do sleep 30; done"' -f $Distribution, $marker
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    [void][System.Diagnostics.Process]::Start($info)
    Write-MichelLog 'Maintien d''Ubuntu en marche lance.'
}

# Starts what is not running (systemctl start does nothing for an active unit) and waits for the dashboard and its
# link to the agents. Returns once Michel is ready, throws a message for the user otherwise.
function Start-Michel {
    $health = Get-MichelHealth
    if ($health.Running -and $health.Gateway) { Write-MichelLog 'Michel tourne deja.'; return 'Michel est pret.' }
    Write-MichelLog 'Michel arrete : demarrage des services.'
    $loadState = Invoke-MichelSystemctl -Arguments @('show', '--property=LoadState', '--value', 'michel-web.service')
    if ($loadState -ne 'loaded') { throw "Les services de Michel ne sont pas installes dans $Distribution." }
    [void](Invoke-MichelSystemctl -Arguments (@('start') + $script:Units))
    $states = Invoke-MichelSystemctl -Arguments (@('show', '--property=ActiveState', '--value') + $script:Units)
    $activeStates = @($states -split '\r?\n' | Where-Object { $_.Trim() })
    if ($activeStates.Count -ne $script:Units.Count -or @($activeStates | Where-Object { $_ -ne 'active' }).Count -gt 0) {
        throw "Un service de Michel n'a pas demarre. Consultez les journaux des services dans Ubuntu."
    }
    Start-MichelKeepAlive
    Write-MichelLog 'Services actifs, attente du tableau de bord.'
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        $health = Get-MichelHealth
        if ($health.Running -and $health.Gateway) { Write-MichelLog 'Michel est pret.'; return 'Michel est pret.' }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Michel ne repond pas apres deux minutes. Relancez-le ; si cela se repete, consultez les journaux dans Ubuntu."
}

if ($Action -eq 'Status') {
    $health = Get-MichelHealth
    $health | ConvertTo-Json -Compress
    if ($health.Running -and $health.Gateway) { exit 0 }
    exit 1
}

# A second double-click while Michel starts must not open a second tab.
$mutex = New-Object System.Threading.Mutex($false, 'Local\MichelLauncher')
if (-not $mutex.WaitOne(0)) { Write-MichelLog 'Lancement deja en cours : double-clic ignore.'; exit 0 }
try {
    Write-MichelLog 'Lancement.'
    [void](Start-Michel)
    Start-MichelKeepAlive
    if (-not $NoBrowser) {
        Write-MichelLog "Ouverture du navigateur sur $script:MichelUrl."
        Start-Process $script:MichelUrl
        Write-MichelLog 'Navigateur ouvert.'
    }
    exit 0
} catch {
    Write-MichelLog "Erreur : $($_.Exception.Message)"
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Michel', 'OK', 'Error')
    exit 1
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
