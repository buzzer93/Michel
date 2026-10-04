$ErrorActionPreference = 'Stop'
$taskPath = Join-Path $PSScriptRoot 'Michel.ps1'
$taskAst = [System.Management.Automation.Language.Parser]::ParseFile($taskPath, [ref]$null, [ref]$null)
foreach ($name in @('Start-Michel')) {
    $definition = $taskAst.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    . ([scriptblock]::Create($definition.Extent.Text))
}
$Distribution = 'Ubuntu'
$script:Units = @('michel-ollama', 'openclaw-gateway', 'michel-stt', 'michel-stt-precise', 'michel-tts', 'michel-tts-st', 'michel-web')
$script:Calls = @()
$script:Installed = $true
$script:States = ''
$script:Ready = $false
function Invoke-MichelSystemctl {
    param([string[]]$Arguments)
    $script:Calls += ,$Arguments
    if ($Arguments -contains '--property=LoadState') { if ($script:Installed) { return 'loaded' } else { return 'not-found' } }
    if ($Arguments -contains '--property=ActiveState') { return $script:States }
    if ($Arguments[0] -eq 'start') { $script:Ready = $true }
    return ''
}
function Get-MichelHealth { return @{ Running = $script:Ready; Gateway = $script:Ready } }
function Start-Sleep { }
function Write-MichelLog { }
function Start-MichelKeepAlive { }
function Assert($Condition, $Message) { if (-not $Condition) { throw $Message } }

# Already running: opens at once, never touches the services.
$script:Ready = $true; $script:Calls = @()
Assert ((Start-Michel) -eq 'Michel est pret.') 'Ready response'
Assert ($script:Calls.Count -eq 0) 'A running Michel must not be restarted'

# Stopped: starts exactly the seven services, then waits until ready.
$script:Ready = $false; $script:Calls = @()
$script:States = (@('active') * 7) -join [Environment]::NewLine
Assert ((Start-Michel) -eq 'Michel est pret.') 'Start response'
$start = @($script:Calls | Where-Object { $_[0] -eq 'start' })[0]
Assert ($start.Count -eq 8) 'Start must target exactly seven services'
Assert ($start -contains 'michel-web' -and $start -contains 'openclaw-gateway') 'Start must include web and gateway'
Assert (-not ($script:Calls | Where-Object { $_[0] -eq 'stop' })) 'The launcher never stops anything'

$script:Ready = $false; $script:Installed = $false
$failed = $false
try { Start-Michel } catch { $failed = $_.Exception.Message -like '*ne sont pas installes*' }
Assert $failed 'Missing installation must be reported'

$script:Ready = $false; $script:Installed = $true
$script:States = (@('active') * 6 + @('failed')) -join [Environment]::NewLine
$failed = $false
try { Start-Michel } catch { $failed = $_.Exception.Message -like "*n'a pas demarre*" }
Assert $failed 'Partial startup must be reported'
'Launcher tests: PASS'
