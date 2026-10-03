import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_STOP_UNIT, stopAllCommand } from "../system-control.mjs";

test("system deployment starts only the dedicated stop unit", () => {
  assert.deepEqual(stopAllCommand(true), [
    "/usr/bin/systemctl",
    ["--no-block", "start", SYSTEM_STOP_UNIT],
  ]);
});

test("user deployment stops only its Jarvis units", () => {
  assert.deepEqual(stopAllCommand(false), [
    "systemctl",
    ["--user", "--no-block", "stop", "jarvis-stt", "jarvis-stt-precise", "jarvis-tts", "jarvis-tts-st", "jarvis-web"],
  ]);
});