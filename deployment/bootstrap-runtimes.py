import hashlib
import json
import pathlib
import subprocess
import urllib.request

cache = pathlib.Path('/opt/jarvis-downloads')
cache.mkdir(exist_ok=True)

def fetch_json(url):
    with urllib.request.urlopen(url) as response:
        return json.load(response)

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

releases = fetch_json('https://nodejs.org/dist/index.json')
version = next(entry['version'] for entry in releases if entry['version'].startswith('v24.'))
filename = f'node-{version}-linux-x64.tar.xz'
base = f'https://nodejs.org/dist/{version}'
with urllib.request.urlopen(base + '/SHASUMS256.txt') as response:
    checksums = dict((line.split()[1], line.split()[0]) for line in response.read().decode().splitlines())
archive = download(base + '/' + filename, filename, checksums[filename])
path = pathlib.Path('/opt/jarvis-node')
path.mkdir(exist_ok=True)
subprocess.run(['tar', '-xJf', str(archive), '--strip-components=1', '-C', str(path)], check=True)
print('Node installed:', version, flush=True)

release = fetch_json('https://api.github.com/repos/ollama/ollama/releases/tags/v0.35.0')
asset = next(asset for asset in release['assets'] if asset['name'] == 'ollama-linux-amd64.tar.zst')
expected = '1c114a6b220c5efca2ef2b1e5f01d1e535e26f6cd6d1678c8489325d2835e525'
archive = download(asset['browser_download_url'], asset['name'], expected)
path = pathlib.Path('/opt/jarvis-ollama')
path.mkdir(exist_ok=True)
subprocess.run(['tar', '--zstd', '-xf', str(archive), '-C', str(path)], check=True)
print('Ollama installed:', release['tag_name'], flush=True)
