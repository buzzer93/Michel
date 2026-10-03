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

# Starts what is not running (systemctl start does nothing for an active unit) and waits for the dashboard and its
# link to the agents. Returns once Michel is ready, throws a message for the user otherwise.
function Start-Michel {
    $health = Get-MichelHealth
    if ($health.Running -and $health.Gateway) { return 'Michel est pret.' }
    $loadState = Invoke-MichelSystemctl -Arguments @('show', '--property=LoadState', '--value', 'michel-web.service')
    if ($loadState -ne 'loaded') { throw "Les services de Michel ne sont pas installes dans $Distribution." }
    [void](Invoke-MichelSystemctl -Arguments (@('start') + $script:Units))
    $states = Invoke-MichelSystemctl -Arguments (@('show', '--property=ActiveState', '--value') + $script:Units)
    $activeStates = @($states -split '\r?\n' | Where-Object { $_.Trim() })
    if ($activeStates.Count -ne $script:Units.Count -or @($activeStates | Where-Object { $_ -ne 'active' }).Count -gt 0) {
        throw "Un service de Michel n'a pas demarre. Consultez les journaux des services dans Ubuntu."
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        $health = Get-MichelHealth
        if ($health.Running -and $health.Gateway) { return 'Michel est pret.' }
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
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
    [void](Start-Michel)
    if (-not $NoBrowser) { Start-Process $script:MichelUrl }
    exit 0
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Michel', 'OK', 'Error')
    exit 1
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
