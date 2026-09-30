import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import WebSocket from 'ws';

const enabled = process.env.JARVIS_TEST_LOCAL_SECURITY === '1';

test('local-only rejects a foreign Host header', { skip: !enabled }, async () => {
  const status = await new Promise((resolve, reject) => {
    const pending = request('http://127.0.0.1:8480/', { headers: { Host: 'untrusted.example:8480' } }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    pending.on('error', reject);
    pending.end();
  });
  assert.equal(status, 403);
});

for (const origin of ['https://untrusted.example', 'not-a-url']) {
  test(`WebSocket rejects origin ${origin}`, { skip: !enabled }, async () => {
    const status = await new Promise((resolve, reject) => {
      const socket = new WebSocket('ws://127.0.0.1:8480/ws', { origin, handshakeTimeout: 3000 });
      socket.on('open', () => { socket.close(); reject(new Error('Untrusted origin accepted')); });
      socket.on('unexpected-response', (request, response) => { response.resume(); request.destroy(); resolve(response.statusCode); });
      socket.on('error', () => {});
    });
    assert.equal(status, 401);
  });
}

test('local browser WebSocket connects and discovers Michel', { skip: !enabled }, async () => {
  const hello = await new Promise((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:8480/ws', { origin: 'http://127.0.0.1:8480', handshakeTimeout: 3000 });
    socket.on('message', data => { socket.close(); resolve(JSON.parse(data.toString())); });
    socket.on('error', reject);
  });
  assert.equal(hello.t, 'hello');
  assert.equal(hello.link, true);
  assert.equal(hello.agents[0].name, 'Michel');
});
