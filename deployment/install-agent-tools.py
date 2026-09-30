import hashlib
import json
import pathlib
import subprocess
import tarfile
import urllib.request

# CLIs used by the tool agents (agenda: gog, dev: gh + docker) and the Claude Code runtime.
# Run as root after bootstrap-runtimes.py; logins are done afterwards as the jarvis user.
cache = pathlib.Path('/opt/jarvis-downloads')
cache.mkdir(exist_ok=True)
bin_dir = pathlib.Path('/usr/local/bin')

def fetch_json(url):
    with urllib.request.urlopen(url) as response:
        return json.load(response)

def fetch_checksums(url):
    with urllib.request.urlopen(url) as response:
        return dict((line.split()[1], line.split()[0]) for line in response.read().decode().splitlines() if line.strip())

def download(url, filename, expected):
    target = cache / filename
    if not target.exists():
        print('Downloading', filename, flush=True)
        urllib.request.urlretrieve(url, target)
    with target.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected:
        raise RuntimeError(f'Checksum mismatch: {filename}')
    print('SHA256 verified:', filename, flush=True)
    return target

def install_binary(archive, name):
    # Archive layouts differ (./gog, gh_<v>_linux_amd64/bin/gh): pick the regular file named `name`.
    with tarfile.open(archive) as tar:
        member = next(m for m in tar.getmembers() if m.isfile() and pathlib.PurePosixPath(m.name).name == name)
        target = bin_dir / name
        target.write_bytes(tar.extractfile(member).read())
    target.chmod(0o755)

version = '0.42.0'
base = f'https://github.com/openclaw/gogcli/releases/download/v{version}'
filename = f'gogcli_{version}_linux_amd64.tar.gz'
archive = download(f'{base}/{filename}', filename, fetch_checksums(f'{base}/checksums.txt')[filename])
install_binary(archive, 'gog')
print('gog installed:', version, flush=True)

release = fetch_json('https://api.github.com/repos/cli/cli/releases/latest')
version = release['tag_name'].lstrip('v')
base = f'https://github.com/cli/cli/releases/download/v{version}'
filename = f'gh_{version}_linux_amd64.tar.gz'
archive = download(f'{base}/{filename}', filename, fetch_checksums(f'{base}/gh_{version}_checksums.txt')[filename])
install_binary(archive, 'gh')
print('gh installed:', version, flush=True)

subprocess.run(['/opt/jarvis-node/bin/npm', 'install', '--global', '--prefix', '/opt/jarvis-node', '@anthropic-ai/claude-code@2.1.285'],
               env={'PATH': '/opt/jarvis-node/bin:/usr/bin:/bin'}, check=True)
print('Claude Code installed: 2.1.285', flush=True)
