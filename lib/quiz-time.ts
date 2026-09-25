/** Eastern-time formatting and parsing for quiz windows (the course runs on ET). */

export const COURSE_TIME_ZONE = "America/New_York";

/** "Mon Oct 5, 9:00 PM" in Eastern time. */
export function formatEt(iso: string | null | undefined, options: { year?: boolean; zone?: boolean } = {}) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: options.year ? "numeric" : undefined, timeZone: COURSE_TIME_ZONE });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: COURSE_TIME_ZONE });
  return `${day.replace(",", "")}, ${time}${options.zone ? " ET" : ""}`;
}

function etParts(epochMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COURSE_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Offset of Eastern time from UTC at an instant, in minutes (e.g. -240). */
function etOffsetMinutes(epochMs: number) {
  const p = etParts(epochMs);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(epochMs / 1000) * 1000) / 60_000);
}

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" wall time in Eastern, for datetime-local inputs. */
export function toEtInput(iso: string | null | undefined) {
  if (!iso) return "";
  const epoch = Date.parse(iso);
  if (Number.isNaN(epoch)) return "";
  const p = etParts(epoch);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "YYYY-MM-DDTHH:mm" Eastern wall time -> ISO timestamp (UTC). */
export function fromEtInput(local: string) {
  if (!local) return null;
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset across DST changes.
  let guess = wall - etOffsetMinutes(wall) * 60_000;
  guess = wall - etOffsetMinutes(guess) * 60_000;
  return new Date(guess).toISOString();
}

/** "14:05" or "1:02:09" for a countdown. */
export function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Spoken form: "4 minutes 30 seconds". */
export function spokenDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s || !m) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return parts.join(" ");
}
