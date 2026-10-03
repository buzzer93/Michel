import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

root = Path('/opt/michel/vendor')

def download(repo, remote, target):
    parent = remote.rsplit('/', 1)[0] if '/' in remote else ''
    endpoint = f'https://huggingface.co/api/models/{repo}/tree/main/{parent}'
    with urllib.request.urlopen(endpoint) as response:
        entries = json.load(response)
    metadata = next(entry for entry in entries if entry['path'] == remote)
    expected = metadata.get('lfs', {}).get('oid')
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        urllib.request.urlretrieve(f'https://huggingface.co/{repo}/resolve/main/{remote}', target)
    with target.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if expected and expected != actual:
        raise RuntimeError(f'Checksum mismatch: {remote}')
    print(f'Ready: {remote} sha256={actual}', flush=True)

jobs = []
for model in ['ggml-small.bin', 'ggml-large-v3-turbo-q5_0.bin']:
    jobs.append(('ggerganov/whisper.cpp', model, root / 'models' / model))
for voice in ['siwis', 'tom', 'upmc']:
    for extension in ['onnx', 'onnx.json']:
        name = f'fr_FR-{voice}-medium.{extension}'
        jobs.append(('rhasspy/piper-voices', f'fr/fr_FR/{voice}/medium/{name}', root / 'voices/models' / name))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures = [pool.submit(download, *job) for job in jobs]
    for future in concurrent.futures.as_completed(futures):
        future.result()
