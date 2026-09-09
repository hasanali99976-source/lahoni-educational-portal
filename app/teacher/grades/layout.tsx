import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import GradesPrintEnhancer from "./grades-print-enhancer";
import GradeHistoryRecorder from "./grade-history-recorder";
import "../teacher-batch-v22.css";

export default function GradesLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><GradesPrintEnhancer /><GradeHistoryRecorder />{children}</>;
}
