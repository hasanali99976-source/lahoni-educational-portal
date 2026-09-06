import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import GradesPrintEnhancer from "./grades-print-enhancer";
import GradeHistoryRecorder from "./grade-history-recorder";
import GradeDeductionsPanel from "./grade-deductions-panel";

export default function GradesLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><GradesPrintEnhancer /><GradeHistoryRecorder /><GradeDeductionsPanel />{children}</>;
}
