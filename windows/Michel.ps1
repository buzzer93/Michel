[CmdletBinding()]
param(
    [ValidateSet('Gui', 'Start', 'Stop', 'Status')]
    [string]$Action = 'Gui',
    [ValidatePattern('^[a-zA-Z0-9_.-]+$')]
    [string]$Distribution = 'Ubuntu',
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$script:MichelUrl = 'http://localhost:8480'

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
            throw "Ubuntu ne repond pas apres deux minutes. Reessayez depuis le lanceur."
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

function Invoke-MichelAction {
    param([string]$RequestedAction)
    $loadState = Invoke-MichelSystemctl -Arguments @('show', '--property=LoadState', '--value', 'michel-web.service')
    if ($loadState -ne 'loaded') { throw "Les services de Michel ne sont pas installes dans $Distribution." }
    $units = @('michel-web', 'openclaw-gateway', 'michel-stt', 'michel-stt-precise', 'michel-tts', 'michel-tts-st', 'michel-ollama')
    if ($RequestedAction -eq 'Stop') {
        [void](Invoke-MichelSystemctl -Arguments (@('stop') + $units))
        $states = Invoke-MichelSystemctl -Arguments (@('show', '--property=ActiveState', '--value') + $units)
        if ($states -match '(?m)^(active|activating|deactivating|reloading)$') {
            throw "Certains services ne sont pas encore arretes. Reessayez."
        }
        return 'Michel est arrete.'
    }
    [void](Invoke-MichelSystemctl -Arguments (@('start') + $units))
    $states = Invoke-MichelSystemctl -Arguments (@('show', '--property=ActiveState', '--value') + $units)
    $activeStates = @($states -split '\r?\n' | Where-Object { $_.Trim() })
    if ($activeStates.Count -ne $units.Count -or @($activeStates | Where-Object { $_ -ne 'active' }).Count -gt 0) {
        throw "Un service n'a pas demarre. Consultez les journaux des services dans Ubuntu."
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        $health = Get-MichelHealth
        if ($health.Running -and $health.Gateway) { return 'Michel est pret.' }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Michel demarre encore ou rencontre une erreur. Cliquez sur Demarrer pour reessayer. Consultez les journaux des services dans Ubuntu."
}

if ($Action -eq 'Status') {
    $health = Get-MichelHealth
    $health | ConvertTo-Json -Compress
    if ($health.Running -and $health.Gateway) { exit 0 }
    exit 1
}
if ($Action -ne 'Gui') {
    try {
        Invoke-MichelAction -RequestedAction $Action
        if ($Action -eq 'Start' -and -not $NoBrowser) { Start-Process $script:MichelUrl }
        exit 0
    } catch {
        Write-Error -Message $_.Exception.Message -ErrorAction Continue
        exit 1
    }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Michel'
$form.ClientSize = New-Object System.Drawing.Size(480, 260)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(24, 28, 37)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$iconPath = Join-Path $PSScriptRoot 'assets\michel.ico'
$form.Icon = if (Test-Path -LiteralPath $iconPath) {
    New-Object System.Drawing.Icon($iconPath, 32, 32)
} else { [System.Drawing.SystemIcons]::Application }

$title = New-Object System.Windows.Forms.Label
$title.Text = 'MICHEL'
$title.Font = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Bold)
$title.SetBounds(28, 22, 420, 52)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Votre assistant vocal'
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(171, 183, 200)
$subtitle.SetBounds(30, 77, 420, 24)
$form.Controls.Add($subtitle)

$status = New-Object System.Windows.Forms.Label
$status.Text = 'Verification...'
$status.SetBounds(30, 116, 420, 32)
$form.Controls.Add($status)

$buttons = @{}
$i = 0
foreach ($entry in @(@('Start', 'Demarrer'), @('Open', 'Ouvrir'), @('Stop', 'Arreter'))) {
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $entry[1]
    $button.SetBounds((30 + $i * 142), 166, 132, 42)
    $button.FlatStyle = 'Flat'
    $button.FlatAppearance.BorderSize = 0
    $button.BackColor = if ($entry[0] -eq 'Start') { [System.Drawing.Color]::FromArgb(53, 111, 220) } else { [System.Drawing.Color]::FromArgb(48, 55, 70) }
    $button.ForeColor = [System.Drawing.Color]::White
    $form.Controls.Add($button)
    $buttons[$entry[0]] = $button
    $i++
}
$hint = New-Object System.Windows.Forms.Label
$hint.Text = 'Fermer cette fenetre laisse Michel fonctionner.'
$hint.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$hint.ForeColor = $subtitle.ForeColor
$hint.SetBounds(30, 226, 420, 22)
$form.Controls.Add($hint)

$script:MichelJob = $null
$script:PendingAction = $null
$script:LastHealthCheck = [DateTime]::MinValue
$script:LauncherPath = $PSCommandPath

function Start-MichelJob {
    param([string]$RequestedAction)
    if ($script:MichelJob) { return }
    foreach ($b in $buttons.Values) { $b.Enabled = $false }
    $status.Text = if ($RequestedAction -eq 'Start') { 'Demarrage de Michel...' } else { 'Arret de Michel...' }
    $script:PendingAction = $RequestedAction
    $script:MichelJob = Start-Job -ArgumentList $script:LauncherPath, $RequestedAction, $Distribution -ScriptBlock {
        param($LauncherPath, $RequestedAction, $Distribution)
        & "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $LauncherPath -Action $RequestedAction -Distribution $Distribution -NoBrowser 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -ne 0) { throw "L'operation a echoue." }
    }
}

$buttons.Start.Add_Click({ Start-MichelJob -RequestedAction 'Start' })
$buttons.Stop.Add_Click({ Start-MichelJob -RequestedAction 'Stop' })
$buttons.Open.Add_Click({ Start-Process $script:MichelUrl })
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 500
$timer.Add_Tick({
    if ($script:MichelJob) {
        if ($script:MichelJob.State -in @('Completed', 'Failed', 'Stopped')) {
            $job = $script:MichelJob
            $messages = @(Receive-Job $job -ErrorAction SilentlyContinue 2>&1)
            $success = $job.State -eq 'Completed'
            Remove-Job $job -Force
            $script:MichelJob = $null
            foreach ($b in $buttons.Values) { $b.Enabled = $true }
            if ($success) {
                $status.Text = if ($script:PendingAction -eq 'Start') { 'Michel est pret.' } else { 'Michel est arrete.' }
                if ($script:PendingAction -eq 'Start' -and -not $NoBrowser) { Start-Process $script:MichelUrl }
            } else {
                $status.Text = "L'operation a echoue."
                [void][System.Windows.Forms.MessageBox]::Show(($messages -join [Environment]::NewLine), 'Michel', 'OK', 'Error')
            }
            $script:LastHealthCheck = [DateTime]::UtcNow
        }
    } elseif (([DateTime]::UtcNow - $script:LastHealthCheck).TotalSeconds -ge 5) {
        $health = Get-MichelHealth
        $status.Text = if ($health.Running -and $health.Gateway) { 'Michel est pret.' } elseif ($health.Running) { 'Connexion aux agents en cours...' } else { 'Michel est arrete.' }
        $buttons.Open.Enabled = $health.Running
        $script:LastHealthCheck = [DateTime]::UtcNow
    }
})
$form.Add_FormClosing({
    param($sender, $eventArgs)
    if ($script:MichelJob) {
        $eventArgs.Cancel = $true
        $status.Text = "Patientez jusqu'a la fin de l'operation..."
    }
})
$form.Add_FormClosed({ $timer.Stop(); $timer.Dispose() })
$timer.Start()
[void]$form.ShowDialog()
$form.Dispose()
