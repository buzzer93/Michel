$ErrorActionPreference = 'Stop'
$taskPath = Join-Path $PSScriptRoot 'Michel.ps1'
$taskAst = [System.Management.Automation.Language.Parser]::ParseFile($taskPath, [ref]$null, [ref]$null)
foreach ($name in @('Invoke-MichelAction')) {
    $definition = $taskAst.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    . ([scriptblock]::Create($definition.Extent.Text))
}
$Distribution = 'Ubuntu'
$script:Calls = @()
$script:Backend = 'michel'
$script:States = "inactive"
function Invoke-MichelSystemctl {
    param([string[]]$Arguments)
    $script:Calls += ,$Arguments
    if ($Arguments -contains '--property=LoadState') {
        if ($Arguments[-1] -eq "$script:Backend-web.service") { return 'loaded' }
        return 'not-found'
    }
    if ($Arguments -contains '--property=ActiveState') { return $script:States }
    return ''
}
function Get-MichelHealth { return @{ Running = $true; Gateway = $true } }
function Assert($Condition, $Message) { if (-not $Condition) { throw $Message } }

foreach ($backend in @('michel','jarvis')) {
    $script:Backend = $backend
    $script:Calls = @()
    $script:States = (@('inactive') * 7) -join ([Environment]::NewLine + [Environment]::NewLine)
    Assert ((Invoke-MichelAction Stop) -eq 'Michel est arrete.') 'Stop response'
    $stop = @($script:Calls | Where-Object { $_[0] -eq 'stop' })[0]
    Assert ($stop.Count -eq 8) 'Stop must target exactly seven services'
    Assert ($stop -contains "$backend-web") 'Stop must target the selected web service'
    Assert ($stop -contains 'openclaw-gateway') 'Stop must include the gateway'
    Assert (-not ($stop -contains '--all')) 'Stop must never target unrelated services'
    $script:States = (@('active') * 7) -join ([Environment]::NewLine + [Environment]::NewLine)
    Assert ((Invoke-MichelAction Start) -eq 'Michel est pret.') 'Start response'
}
$script:Backend = 'absent'
$failed = $false
try { Invoke-MichelAction Start } catch { $failed = $_.Exception.Message -like '*ne sont pas installes*' }
Assert $failed 'Missing installation must be reported'

$script:Backend = 'michel'
$script:States = (@('active') * 6 + @('failed')) -join [Environment]::NewLine
$failed = $false
try { Invoke-MichelAction Start } catch { $failed = $_.Exception.Message -like "*n'a pas demarre*" }
Assert $failed 'Partial startup must be reported'

$script:States = 'active'
$failed = $false
try { Invoke-MichelAction Stop } catch { $failed = $_.Exception.Message -like '*pas encore arretes*' }
Assert $failed 'Incomplete stop must be reported'
'Launcher control tests: PASS'
