"use client";

// The teacher roster is loaded by the page that actually needs it.
// Keeping a global sync here caused repeated /api/teacher/students calls
// whenever the teacher shell remounted, which wasted Firestore reads.
export default function CentralRosterSync() {
  return null;
}
