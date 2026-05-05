export function formatAbsoluteForA11y(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return '--';
  }
  let diff = nowMs - t;
  if (diff < 0) {
    diff = 0;
  }

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return 'now';
  }
  if (diff < hour) {
    const m = Math.max(1, Math.floor(diff / minute));
    return `${m}m`;
  }
  if (diff < day) {
    const h = Math.max(1, Math.floor(diff / hour));
    return `${h}h`;
  }
  if (diff < 7 * day) {
    const dayCount = Math.max(1, Math.floor(diff / day));
    return `${dayCount}d`;
  }

  const postDate = new Date(iso);
  const yNow = new Date(nowMs).getFullYear();
  const y = postDate.getFullYear();
  const month = postDate.toLocaleString('en-US', { month: 'short' });
  const dom = postDate.getDate();
  if (y === yNow) {
    return `${month} ${dom}`;
  }
  return `${month} ${dom}, ${y}`;
}