#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/cuda-12.8/bin:/usr/bin:/bin
until test -x /usr/local/cuda-12.8/bin/nvcc && dpkg-query -W -f='${Status}' libcublas-dev-12-8 2>/dev/null | grep -q 'install ok installed'; do
    sleep 5
done
cd /opt/jarvis/vendor/whisper.cpp
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DGGML_CUDA=1 -DCMAKE_CUDA_ARCHITECTURES=89 -DWHISPER_SDL2=OFF -DWHISPER_CURL=OFF > /var/lib/jarvis/whisper-build.log 2>&1
cmake --build build --config Release -j 4 >> /var/lib/jarvis/whisper-build.log 2>&1
