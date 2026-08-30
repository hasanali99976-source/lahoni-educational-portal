import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import GradesPrintEnhancer from "./grades-print-enhancer";

export default function GradesLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><GradesPrintEnhancer />{children}</>;
}
