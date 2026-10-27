/** "just now", "4 min ago", "2 h ago", "3 d ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** Active in the last two minutes. */
export function isLive(iso: string, now = Date.now()): boolean {
  return now - new Date(iso).getTime() < 120_000;
}
