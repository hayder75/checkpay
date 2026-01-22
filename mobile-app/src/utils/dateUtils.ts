/**
 * Formats time in 12-hour format with AM/PM
 */
export function formatTime12Hour(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Formats date and time in 12-hour format
 */
export function formatDateTime12Hour(dateString: string): string {
  const date = new Date(dateString);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const time = formatTime12Hour(date);
  return `${month} ${day}, ${time}`;
}
