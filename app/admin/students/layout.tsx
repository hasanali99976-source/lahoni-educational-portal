import ClassControlPanel from "./class-control-panel";

export default function AdminStudentsLayout({ children }: { children: React.ReactNode }) {
  return <>
    {children}
    <ClassControlPanel />
  </>;
}
