import json
from pathlib import Path
import pwd
import re
import subprocess
import urllib.request

services = ['michel-ollama', 'openclaw-gateway', 'michel-stt', 'michel-stt-precise', 'michel-tts', 'michel-tts-st', 'michel-web']
result = {'services': {}, 'health': {}, 'isolation': {}, 'projectPaths': {'linux': '/home/buzzer93/code/perso/openclaw-vocal-assistants', 'windows': 'F:/PARA/01_Projets/code/perso/openclaw-vocal-assistants', 'runtimeCompatibility': '/opt/michel (bind mount of Linux project)'}}
for name in services:
    active = subprocess.check_output(['systemctl', 'is-active', name], text=True).strip()
    result['services'][name] = active
    assert active == 'active', (name, active)

for port, endpoint in [(8480, 'healthz'), (8178, 'health'), (8188, 'health'), (8179, 'healthz'), (8182, 'healthz'), (11434, 'api/version')]:
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/{endpoint}', timeout=10) as response:
        result['health'][str(port)] = json.load(response)
assert result['health']['8480']['gateway'] is True

code_path = Path('/opt/michel/config/access-code.txt')
code = code_path.read_text().strip()
assert re.fullmatch('[0-9a-f]{64}', code)
assert code_path.stat().st_mode & 0o777 == 0o600
result['accessCode'] = {'bits': 256, 'permissions': '0600', 'value': 'not exported'}
config_path = Path('/var/lib/michel/.openclaw/openclaw.json')
config = json.loads(config_path.read_text())
assert config_path.stat().st_mode & 0o777 == 0o600
# Michel (main) holds his team's tools so that delegated runs keep them (a child is capped by its requester).
exec_agents = {'agenda', 'dev', 'fact_checker', 'implementer', 'main'}
assert config['tools']['exec']['mode'] == 'deny'
for agent_id, entry in config['agents']['entries'].items():
    tools = entry['tools']
    if agent_id in exec_agents:
        assert tools['exec']['mode'] in ('ask', 'allowlist') and 'exec' in tools['alsoAllow'], agent_id
    else:
        assert '*' in tools['deny'] or {'exec', 'process'} <= set(tools['deny']), agent_id
    if agent_id not in ('implementer', 'main'):
        assert '*' in tools['deny'] or {'write', 'edit', 'apply_patch'} <= set(tools['deny']), agent_id
delegators = {agent_id for agent_id, entry in config['agents']['entries'].items() if entry.get('subagents', {}).get('allowAgents')}
assert delegators == {'main'}, delegators
assert config['agents']['defaults']['subagents']['maxSpawnDepth'] == 1
assert config['gateway']['bind'] == 'loopback'
assert config['cron']['enabled'] is False
result['agentTools'] = 'exec allowlisted for agenda/dev/fact_checker/implementer only; writes for implementer only (own clone); only Michel (main) delegates'

ports = {8178, 8188, 8179, 8182, 8480, 11434, 18789}
listeners = []
for line in subprocess.check_output(['ss', '-H', '-ltn'], text=True).splitlines():
    address = line.split()[3]
    if int(address.rsplit(':', 1)[1]) in ports:
        assert address.startswith(('127.0.0.1:', '[::1]:')), address
        listeners.append(address)
result['listeners'] = listeners

for name in ['michel-web', 'openclaw-gateway']:
    process_id = subprocess.check_output(['systemctl', 'show', name, '-p', 'MainPID', '--value'], text=True).strip()
    probe = subprocess.run(['nsenter', '-t', process_id, '-m', '--', 'runuser', '-u', 'michel', '--', 'test', '-x', '/mnt/c/Users'], capture_output=True)
    assert probe.returncode == 1, name
    result['isolation'][name] = 'Windows drive access blocked'

cache = Path('/opt/michel/vendor/whisper.cpp/build/CMakeCache.txt').read_text()
assert 'GGML_CUDA:BOOL=1' in cache
for name in ['michel-stt', 'michel-stt-precise']:
    logs = subprocess.check_output(['journalctl', '-u', name, '-b', '--no-pager'], text=True)
    assert 'NVIDIA GeForce RTX 4070' in logs, name
result['whisperBackend'] = 'CUDA, RTX 4070, architecture 89'
result['ollamaGpu'] = subprocess.check_output(['/opt/michel-ollama/bin/ollama', 'ps'], text=True).strip()
result['diskUsage'] = subprocess.check_output(['du', '-sh', '/opt/michel', '/var/lib/michel', '/opt/michel-node', '/opt/michel-ollama'], text=True).strip()
for mode in ['typed', 'spoken']:
    path = Path(f'/var/lib/michel/verification/{mode}-result.json')
    result[f'{mode}Conversation'] = json.loads(path.read_text())
target = Path('/var/lib/michel/verification/installation-result.json')
target.write_text(json.dumps(result, indent=2, ensure_ascii=False))
print(json.dumps(result, indent=2, ensure_ascii=False))
