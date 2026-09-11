"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type CSSProperties, ReactNode, useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getSubjectConfig, type SubjectKey } from "../../lib/subject-config";
import { readLocalGradePlan, setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import { TeacherClientContext, type TeacherClientAssignment, type TeacherClientSubject } from "../../lib/teacher-client";
import "./print-theme.css";
import "./teacher-intelligence-v20.css";
import "./teacher-command-v21.css";

// V21 styling is intentionally layered after V20. The existing component, routes,
// session handling, subject switching, Firestore/Firebase behavior and all records
// remain unchanged.

export { default } from "./teacher-layout-core";
