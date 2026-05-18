/**
 * Converts an HH:MM string to pure minutes from midnight which allows us to perform stable line-segment comparisons.
 */
export function parseTimeToMinutes(timeString: string): number {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}
/**
 * Converts pure minutes from midnight back into an HH:MM string
 */
export function parseMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}