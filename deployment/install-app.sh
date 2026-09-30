#!/usr/bin/env bash
set -euo pipefail
export PATH=/opt/jarvis-node/bin:/usr/local/cuda-12.8/bin:/usr/local/bin:/usr/bin:/bin
cd /opt/jarvis
git clone --depth 1 --branch v1.9.4 https://github.com/ggml-org/whisper.cpp.git vendor/whisper.cpp
python3 -m venv .venv
.venv/bin/pip install piper-tts onnxruntime numpy scipy soundfile supertonic==1.3.1 num2words > /var/lib/jarvis/python-install.log 2>&1
cd server
npm ci --ignore-scripts > /var/lib/jarvis/npm-install.log 2>&1
cd /var/lib/jarvis
mkdir -p openclaw-runtime
cd openclaw-runtime
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --omit=dev openclaw@2026.9.7 > /var/lib/jarvis/openclaw-install.log 2>&1
