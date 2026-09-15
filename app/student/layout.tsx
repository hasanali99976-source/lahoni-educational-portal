import "./student-classic-v103.css";
import "../portal-v100.css";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <div className="portal-v100 student-app-shell" dir="rtl">{children}</div>;
}
