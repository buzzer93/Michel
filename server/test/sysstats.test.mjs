import test from "node:test";
import assert from "node:assert/strict";
import { parseProcStat, cpuPercent, parseMeminfo, parseNvidiaSmi } from "../sysstats.mjs";

test("CPU : pourcentage occupé entre deux lectures de /proc/stat", () => {
  const a = parseProcStat("cpu  100 0 100 700 100 0 0 0 0 0\ncpu0 1 2 3");
  const b = parseProcStat("cpu  200 0 200 750 150 0 0 0 0 0\n");
  assert.deepEqual(a, { idle: 800, total: 1000 });
  assert.equal(cpuPercent(a, b), 67); // 300 jiffies, 100 idle
  assert.equal(cpuPercent(a, a), 0);
});

test("RAM : utilisée = total - disponible, en Mio", () => {
  assert.deepEqual(parseMeminfo("MemTotal:       16336508 kB\nMemFree:  1 kB\nMemAvailable:    9061996 kB\n"), { usedMb: 7104, totalMb: 15954 });
});

test("GPU : première carte de nvidia-smi, rien si la sortie est invalide", () => {
  assert.deepEqual(parseNvidiaSmi("NVIDIA GeForce RTX 4070, 28, 7901, 12282, 53\n"), { name: "NVIDIA GeForce RTX 4070", util: 28, memUsedMb: 7901, memTotalMb: 12282, tempC: 53 });
  assert.equal(parseNvidiaSmi("NVIDIA-SMI has failed"), null);
  assert.equal(parseNvidiaSmi(""), null);
});
