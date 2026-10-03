export const SYSTEM_STOP_UNIT = "jarvis-dashboard-stop.service";
export const SYSTEM_STOP_UNIT_FILE = `/etc/systemd/system/${SYSTEM_STOP_UNIT}`;

const userUnits = ["jarvis-stt", "jarvis-stt-precise", "jarvis-tts", "jarvis-tts-st", "jarvis-web"];

export function stopAllCommand(systemManaged) {
  if (systemManaged) return ["/usr/bin/systemctl", ["--no-block", "start", SYSTEM_STOP_UNIT]];
  return ["systemctl", ["--user", "--no-block", "stop", ...userUnits]];
}
