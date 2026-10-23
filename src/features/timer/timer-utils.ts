export function secondsRemaining(deadline: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function isValidTimerDuration(seconds: number) {
  return Number.isInteger(seconds) && seconds > 0;
}
