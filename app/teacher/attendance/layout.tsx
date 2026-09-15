import type { ReactNode } from "react";
import AttendanceClassDeepLink from "./attendance-class-deep-link";
import "./attendance-compact-current.css";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <>
    <AttendanceClassDeepLink />
    {children}
  </>;
}
