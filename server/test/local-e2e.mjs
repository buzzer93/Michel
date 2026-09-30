import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import WebSocket from 'ws';

const typed = process.argv.includes('--typed');
const arithmetic = process.argv.includes('--arithmetic');
const mode = typed ? 'typed' : 'spoken';
const directory = '/var/lib/jarvis/verification';
mkdirSync(directory, { recursive: true });
const phrase = arithmetic ? 'Michel, combien font douze fois douze ? Réponds en une phrase.' : 'Michel, dis exactement : bonjour, la connexion vocale fonctionne.';
let input;
if (!typed) {
  const response = await fetch('http://127.0.0.1:8179/tts', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agent: 'main', engine: 'piper', text: phrase }),
  });
  assert.equal(response.status, 200);
  writeFileSync(`${directory}/input.wav`, Buffer.from(await response.arrayBuffer()));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${directory}/input.wav`, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', `${directory}/input-16k.wav`]);
  input = readFileSync(`${directory}/input-16k.wav`);
}
const started = Date.now();
const result = { mode, phrase, heard: null, replies: [], audioBytes: 0, firstAudioMs: null, errors: [] };
await new Promise((resolve, reject) => {
  const socket = new WebSocket('ws://127.0.0.1:8480/ws', { origin: 'http://127.0.0.1:8480' });
  const timer = setTimeout(() => { socket.close(); reject(new Error('No completed reply within 180 seconds')); }, 180000);
  socket.on('error', reject);
  socket.on('message', (data, binary) => {
    if (binary) {
      const length = data.readUInt32LE(0);
      const header = JSON.parse(data.subarray(4, 4 + length));
      const audio = data.subarray(4 + length);
      if (header.t === 'say' && header.runId) {
        assert.equal(audio.subarray(0, 4).toString(), 'RIFF');
        result.firstAudioMs ??= Date.now() - started;
        result.replies.push(header.text);
        result.audioBytes += audio.length;
        writeFileSync(`${directory}/${mode}-reply-${result.replies.length}.wav`, audio);
      }
      return;
    }
    const message = JSON.parse(data);
    if (message.t === 'hello') {
      assert.equal(message.link, true);
      if (typed) socket.send(JSON.stringify({ t: 'text', text: phrase }));
      else { socket.send(JSON.stringify({ t: 'utt' })); socket.send(input); }
    }
    if (message.t === 'heard') result.heard = message;
    if (message.t === 'notice' && message.level === 'error') result.errors.push(message.text);
    if (message.t === 'done') {
      clearTimeout(timer);
      result.totalMs = Date.now() - started;
      result.tools = message.tools;
      socket.close();
      resolve();
    }
  });
});
writeFileSync(`${directory}/${mode}-result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
assert.deepEqual(result.errors, []);
assert.equal(result.heard?.kind, 'message');
assert.equal(result.tools, 0);
assert.ok(result.audioBytes > 1000);
assert.match(result.replies.join(' '), arithmetic ? /144|cent[ -]quarante[ -]quatre/i : /bonjour.*connexion vocale fonctionne/i);
console.log(`PASS: ${mode} conversation -> OpenClaw -> local model -> spoken reply`);
