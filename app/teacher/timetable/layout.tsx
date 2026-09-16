import type { ReactNode } from "react";

export default function TimetableLayout({ children }: { children: ReactNode }) {
  // Emergency drain guard: timetable changes are already saved explicitly by page.tsx.
  // Do not mount the background auto-sync worker, which can retry stale local writes
  // whenever the timetable route is opened or the browser reconnects.
  return <>{children}</>;
}
