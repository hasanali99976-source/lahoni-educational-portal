# Consolidated portal release

This release preserves the current production data model and bundles teacher/student portal fixes for a single production publish.

- Teacher timetable remains the source for daily preparation.
- Preparation autosaves only after a meaningful edit and keeps the same date/period/class record.
- Riyadh date rollover refreshes the current preparation day.
- Existing gradebook, student visual, dashboard timetable, roster cache and drain-protection changes on main are retained.
- Web/mobile use the same server APIs and Firestore data; local storage is only a UI fallback where already present.

Do not split this bundle into repeated production deployments.
