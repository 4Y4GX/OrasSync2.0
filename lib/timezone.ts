// lib/timezone.ts
// Centralized timezone handling to ensure consistent time tracking
// regardless of server or client timezone settings

export const APP_TIMEZONE = 'Asia/Manila';

/**
 * Get the current date/time in the app's timezone (Asia/Manila)
 * This is independent of server locale or client device settings
 */
export function getNowInTimezone(): Date {
  // Get current UTC time
  const now = new Date();
  
  // Convert to Asia/Manila timezone string
  const manilaTimeStr = now.toLocaleString('en-US', { 
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse the Manila time string back to a Date
  // Format: "MM/DD/YYYY, HH:MM:SS"
  const [datePart, timePart] = manilaTimeStr.split(', ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Get time components in app timezone for storing in TIME field
 * Returns a Date object with time values that can be stored correctly
 */
export function getTimeForStorage(): Date {
  const manilaTime = getNowInTimezone();
  // Create a UTC date with the local time values to store correctly in TIME field
  return new Date(Date.UTC(
    1970, 0, 1,
    manilaTime.getHours(),
    manilaTime.getMinutes(),
    manilaTime.getSeconds()
  ));
}

/**
 * Get today's date at midnight in app timezone
 */
export function getTodayInTimezone(): Date {
  const manilaTime = getNowInTimezone();
  return new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate());
}

/**
 * Convert a stored TIME field value to display time
 * @param timeValue - Date object from Prisma TIME field
 * @returns Object with hours, minutes, seconds in app timezone
 */
export function parseStoredTime(timeValue: Date | null): { hours: number; minutes: number; seconds: number } | null {
  if (!timeValue) return null;
  return {
    hours: timeValue.getUTCHours(),
    minutes: timeValue.getUTCMinutes(),
    seconds: timeValue.getUTCSeconds(),
  };
}

/**
 * Convert a UTC Date to Asia/Manila timezone and get the hour
 */
export function getHourInTimezone(date: Date): number {
  const manilaTimeStr = date.toLocaleString('en-US', { 
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    hour12: false
  });
  return parseInt(manilaTimeStr, 10);
}

/**
 * Combine a shift date with a stored time value to create a full datetime
 * Handles overnight shifts by detecting if time is after midnight
 * @param timeValue - TIME field value from database
 * @param shiftDate - The shift date
 * @param clockInTime - Clock in time to detect overnight shifts
 */
export function combineShiftDateWithTime(
  timeValue: Date | null,
  shiftDate: Date,
  clockInTime: Date
): Date | null {
  if (!timeValue) return null;
  
  const time = parseStoredTime(timeValue);
  if (!time) return null;
  
  // Get the clock-in hour in Asia/Manila timezone to properly detect night shifts
  const clockInHour = getHourInTimezone(clockInTime);
  
  // If clock-in was in the evening (after noon) and activity time is in the early morning,
  // the activity is likely after midnight, so add 1 day
  const isAfterMidnight = clockInHour >= 12 && time.hours < 12;
  
  const baseDate = new Date(
    shiftDate.getFullYear(),
    shiftDate.getMonth(),
    shiftDate.getDate(),
    time.hours,
    time.minutes,
    time.seconds
  );
  
  if (isAfterMidnight) {
    baseDate.setDate(baseDate.getDate() + 1);
  }
  
  return baseDate;
}
