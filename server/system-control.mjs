export const SYSTEM_STOP_UNIT = "michel-dashboard-stop.service";
export const SYSTEM_STOP_UNIT_FILE = `/etc/systemd/system/${SYSTEM_STOP_UNIT}`;

const userUnits = ["michel-stt", "michel-stt-precise", "michel-tts", "michel-tts-st", "michel-web"];

export function stopAllCommand(systemManaged) {
  if (systemManaged) return ["/usr/bin/systemctl", ["--no-block", "start", SYSTEM_STOP_UNIT]];
  return ["systemctl", ["--user", "--no-block", "stop", ...userUnits]];
}
