"use client";

// Legacy guard intentionally disabled.
// The attendance page now owns class/date selection from the official roster
// and timetable. Keeping this DOM patch active caused valid assigned classes
// (for example: الثاني الثانوي 1) to be hidden/disabled in the selector.
export default function AttendanceScheduleGuardV2() {
  return null;
}
