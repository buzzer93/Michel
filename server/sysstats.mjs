// Host load for the dashboard: CPU and RAM from /proc (the Linux/WSL machine), GPU from nvidia-smi when
// present. Sampled only while a page is open.
import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";

/** Idle and total jiffies from the aggregate first line of /proc/stat. */
export function parseProcStat(text) {
  const fields = text.split("\n")[0].trim().split(/\s+/).slice(1).map(Number);
  return { idle: fields[3] + (fields[4] ?? 0), total: fields.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0) };
}

/** CPU busy percentage between two /proc/stat readings. */
export function cpuPercent(prev, cur) {
  const total = cur.total - prev.total;
  return total > 0 ? Math.round(100 * (1 - (cur.idle - prev.idle) / total)) : 0;
}

/** Used and total RAM in MiB ("used" = total minus MemAvailable, as `free` reports it). */
export function parseMeminfo(text) {
  const kb = (key) => Number(new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(text)?.[1] ?? 0);
  const total = kb("MemTotal"), available = kb("MemAvailable");
  return { usedMb: Math.round((total - available) / 1024), totalMb: Math.round(total / 1024) };
}

/** First GPU of `nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits`. */
export function parseNvidiaSmi(text) {
  const [name, util, used, total, temp] = String(text).trim().split("\n")[0].split(",").map((s) => s.trim());
  if (!name || !Number.isFinite(Number(util))) return null;
  return { name, util: Number(util), memUsedMb: Number(used), memTotalMb: Number(total), tempC: Number(temp) };
}

const NVIDIA_SMI = ["/usr/lib/wsl/lib/nvidia-smi", "/usr/bin/nvidia-smi"].find(existsSync);
const GPU_QUERY = ["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"];

export class SysSampler {
  constructor({ intervalMs = 2000, onSample }) { this.intervalMs = intervalMs; this.onSample = onSample; this.timer = null; }

  start() {
    if (this.timer) return;
    this.prev = parseProcStat(readFileSync("/proc/stat", "utf8"));
    this.timer = setInterval(() => this.sample(), this.intervalMs);
    this.timer.unref();
  }

  stop() { clearInterval(this.timer); this.timer = null; }

  sample() {
    let cpu, ram;
    try {
      const cur = parseProcStat(readFileSync("/proc/stat", "utf8"));
      cpu = cpuPercent(this.prev, cur); this.prev = cur;
      ram = parseMeminfo(readFileSync("/proc/meminfo", "utf8"));
    } catch { return; }
    if (!NVIDIA_SMI) return this.onSample({ cpu, ram, gpu: null });
    execFile(NVIDIA_SMI, GPU_QUERY, { timeout: 1500 }, (err, out) => this.onSample({ cpu, ram, gpu: err ? null : parseNvidiaSmi(out) }));
  }
}
