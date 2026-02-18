// lib/timezone.ts
// Centralized timezone handling to ensure consistent time tracking
// regardless of server or client timezone settings

export const APP_TIMEZONE = 'Asia/Manila';
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

/**
 * Get the current date/time in the app's timezone (Asia/Manila)
 * Returns a Date object representing the ACTUAL moment in time (not shifted)
 * The Date's UTC methods will return UTC values, but we also provide helpers
 * to get Manila-adjusted values for display/storage
 */
export function getNowInTimezone(): Date {
  // Return actual current time as a Date object
  // This represents the real moment in time
  return new Date();
}

/**
 * Get Manila time components from the current time
 * Use this when you need Manila hours/minutes/seconds for display or TIME field storage
 */
export function getManilaTimeComponents(): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const manilaTime = new Date(now.getTime() + MANILA_OFFSET_MS);
  return {
    year: manilaTime.getUTCFullYear(),
    month: manilaTime.getUTCMonth(),
    day: manilaTime.getUTCDate(),
    hours: manilaTime.getUTCHours(),
    minutes: manilaTime.getUTCMinutes(),
    seconds: manilaTime.getUTCSeconds(),
  };
}

/**
 * Get time components in app timezone for storing in TIME field
 * Returns a Date object with Manila time values stored as UTC for TIME field storage
 */
export function getTimeForStorage(): Date {
  const manila = getManilaTimeComponents();
  // Create a UTC date with Manila time values to store correctly in TIME field
  return new Date(Date.UTC(
    1970, 0, 1,
    manila.hours,
    manila.minutes,
    manila.seconds
  ));
}

/**
 * Get today's date representing the Manila calendar date
 * Uses noon UTC to avoid date boundary issues with MySQL timezone conversion
 * This ensures the DATE field always stores the correct Manila calendar date
 */
export function getTodayInTimezone(): Date {
  const manila = getManilaTimeComponents();
  // Use noon UTC (12:00) to prevent date shift from MySQL timezone conversion
  // This way, even UTC-12 to UTC+14 timezones will preserve the same date
  return new Date(Date.UTC(manila.year, manila.month, manila.day, 12, 0, 0));
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
 * Combine a shift date with a stored time value to create a full UTC datetime
 * Handles overnight shifts by detecting if time is after midnight
 * @param timeValue - TIME field value from database (stored as Manila time in UTC)
 * @param shiftDate - The shift date (stored as Manila calendar date at UTC midnight)
 * @param clockInTime - Clock in time to detect overnight shifts
 * @returns Date object in UTC representing the actual moment
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
  
  // Create UTC date: shiftDate is at UTC midnight for Manila calendar date
  // time.hours/minutes/seconds are Manila time values stored as UTC in TIME field
  // To convert to actual UTC: subtract 8 hours from the Manila time
  let baseDate = new Date(Date.UTC(
    shiftDate.getUTCFullYear(),
    shiftDate.getUTCMonth(),
    shiftDate.getUTCDate(),
    time.hours,
    time.minutes,
    time.seconds
  ));
  
  // Subtract Manila offset to get actual UTC time
  baseDate = new Date(baseDate.getTime() - MANILA_OFFSET_MS);
  
  if (isAfterMidnight) {
    baseDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return baseDate;
}

/**
 * Construct a proper UTC datetime from stored shift date and time
 * This is the correct way to calculate durations
 * @param shiftDate - DATE field from DB (Manila calendar date, stored at noon UTC)
 * @param startTime - TIME field from DB (Manila time stored as UTC)
 * @returns UTC timestamp representing the actual moment
 */
export function getActualUtcFromStoredDateTime(
  shiftDate: Date,
  startTime: Date
): Date {
  // shiftDate from Prisma DATE field comes back as midnight UTC
  // startTime from Prisma TIME field has Manila hours in UTC positions
  
  // Combine the Manila date with Manila time to get Manila datetime
  // The key is both are already in "Manila pseudo-time" space
  const manilaDatetime = new Date(Date.UTC(
    shiftDate.getUTCFullYear(),
    shiftDate.getUTCMonth(),
    shiftDate.getUTCDate(),
    startTime.getUTCHours(),
    startTime.getUTCMinutes(),
    startTime.getUTCSeconds()
  ));
  
  // Subtract 8 hours to convert Manila time to actual UTC
  return new Date(manilaDatetime.getTime() - MANILA_OFFSET_MS);
}

/**
 * Get current time as Manila pseudo-timestamp for duration calculations
 * This creates a timestamp that matches the storage format (Manila time as UTC)
 */
export function getNowAsManilaTimestamp(): number {
  const manila = getManilaTimeComponents();
  return Date.UTC(manila.year, manila.month, manila.day, manila.hours, manila.minutes, manila.seconds);
}

/**
 * Calculate duration between stored start time and now
 * Uses Manila pseudo-time for both to avoid timezone conversion issues
 * @param shiftDate - DATE field from DB
 * @param startTime - TIME field from DB  
 * @returns Duration in milliseconds
 */
export function calculateDurationMs(
  shiftDate: Date,
  startTime: Date
): number {
  // Convert stored time to Manila pseudo-timestamp
  const startManilaTs = Date.UTC(
    shiftDate.getUTCFullYear(),
    shiftDate.getUTCMonth(),
    shiftDate.getUTCDate(),
    startTime.getUTCHours(),
    startTime.getUTCMinutes(),
    startTime.getUTCSeconds()
  );
  
  // Get current Manila pseudo-timestamp
  const nowManilaTs = getNowAsManilaTimestamp();
  
  // Both are now in the same "Manila pseudo-time" space, so diff is correct
  return Math.max(0, nowManilaTs - startManilaTs);
}
