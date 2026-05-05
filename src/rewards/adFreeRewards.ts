export const AD_REWARD_DAILY_LIMIT = 3;

export const AD_FREE_REDEMPTION_OPTIONS = [
  {
    id: 'short',
    credits: 1,
    durationMs: 30 * 60 * 1000,
    label: '30 minutes',
    description: 'Quick break for a short feed session.',
  },
  {
    id: 'focus',
    credits: 3,
    durationMs: 2 * 60 * 60 * 1000,
    label: '2 hours',
    description: 'Spend a full daily allowance for an extended ad-free run.',
  },
] as const;

export function getLocalDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatRewardDuration(ms: number): string {
  const remainingMs = Math.max(0, ms);
  const totalMinutes = Math.ceil(remainingMs / 60000);

  if (totalMinutes <= 0) {
    return '0 minutes';
  }

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }

  if (minutes > 0 && days === 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  return parts.join(' ');
}
