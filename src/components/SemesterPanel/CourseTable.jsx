// ── CourseTable.jsx ───────────────────────────────────────────────────────────
// Renders the full course grid for a single semester.
//
// Contains:
//   CourseTableHeader  — fixed column label row
//   CourseRow[]        — one editable row per course
//   Empty state        — shown when a semester has no courses yet
//   Footer actions     — Add Course + Bulk Import buttons
//   Disabled overlay   — when no institution is selected
//
// Styles live in SemesterPanel.css (Batch 17).


import React, { useRef, useEffect } from "react";
import CourseRow from "./CourseRow.jsx";


// ── Column configuration ──────────────────────────────────────────────────────
// Single source of truth for the header and the CSS grid template.

const COLUMNS = [
  { key: "name",   label: "Course",         hint: "Course code or name"  },
  { key: "cu",     label: "CU",             hint: "Credit units (1–6)"   },
  { key: "score",  label: "Score",          hint: "Exam score (0–100)"   },
  { key: "grade",  label: "Grade",          hint: "Letter grade"         },
  { key: "gp",     label: "GP",             hint: "Grade point (derived)"},
  { key: "qp",     label: "QP",             hint: "Quality points (derived)"},
];


// ── Main component ────────────────────────────────────────────────────────────

export default function CourseTable({
  courses,
  semesterId,
  activeGradeTable,
  institution,
  onAddCourse,
  onRemoveCourse,
  onUpdateCourse,
  onOpenImport,
}) {
  const isDisabled  = !institution;
  const hasCourses  = courses.length > 0;

  // Ref to the last added row — used to scroll it into view
  const lastRowRef  = useRef(null);
  const prevCountRef = useRef(courses.length);

  useEffect(() => {
    // When a new course is added (count increased), focus its name input
    if (courses.length > prevCountRef.current && lastRowRef.current) {
      const input = lastRowRef.current.querySelector("input[type='text']");
      if (input) {
        input.focus();
        lastRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
    prevCountRef.current = courses.length;
  }, [courses.length]);


  // ── Disabled overlay ──────────────────────────────────────────────────────

  if (isDisabled) {
    return (
      <div className="course-table course-table--disabled">
        <div className="course-table__blocked">
          <span className="course-table__blocked-icon" aria-hidden="true">
            <IconLock />
          </span>
          <p className="course-table__blocked-msg">
            Select your university first to begin entering courses.
          </p>
        </div>
      </div>
    );
  }


  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="course-table" role="table" aria-label="Courses">

      {/* ── Column headers ─────────────────────────────────────────────────── */}
      <div className="course-table__header" role="row">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`course-table__th course-table__th--${col.key}`}
            role="columnheader"
            title={col.hint}
          >
            {col.label}
          </div>
        ))}
        {/* Spacer for delete button column */}
        <div className="course-table__th course-table__th--actions" role="columnheader">
          <span className="sr-only">Actions</span>
        </div>
      </div>


      {/* ── Course rows ────────────────────────────────────────────────────── */}
      {hasCourses ? (
        <div className="course-table__body">
          {courses.map((course, idx) => (
            <CourseRow
              key={course.id}
              ref={idx === courses.length - 1 ? lastRowRef : null}
              course={course}
              activeGradeTable={activeGradeTable}
              rowIndex={idx}
              onUpdate={(courseId, changes) =>
                onUpdateCourse(semesterId, courseId, changes)
              }
              onRemove={(courseId) =>
                onRemoveCourse(semesterId, courseId)
              }
            />
          ))}
        </div>
      ) : (
        <EmptyCoursesState
          onAdd={() => onAddCourse(semesterId)}
          onImport={onOpenImport}
        />
      )}


      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="course-table__footer">
        <button
          className="course-table__add-btn"
          onClick={() => onAddCourse(semesterId)}
          type="button"
          aria-label="Add a new course to this semester"
        >
          <IconPlus />
          <span>Add Course</span>
        </button>

        <button
          className="course-table__import-btn"
          onClick={onOpenImport}
          type="button"
          aria-label="Bulk import courses from text"
          title="Paste multiple courses at once"
        >
          <IconImport />
          <span>Bulk Import</span>
        </button>

        {hasCourses && (
          <span className="course-table__count" aria-live="polite">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </span>
        )}
      </div>

    </div>
  );
}


// ── Empty courses state ───────────────────────────────────────────────────────

function EmptyCoursesState({ onAdd, onImport }) {
  return (
    <div className="course-table__empty">
      <p className="course-table__empty-msg">
        No courses yet. Add them one by one or paste a list.
      </p>
      <div className="course-table__empty-actions">
        <button
          className="btn btn-primary"
          onClick={onAdd}
          type="button"
        >
          <IconPlus />
          Add Course
        </button>
        <button
          className="btn btn-secondary"
          onClick={onImport}
          type="button"
        >
          <IconImport />
          Paste Courses
        </button>
      </div>
    </div>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M7 2v10M2 7h10"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" />
    </svg>
  );
}

function IconImport() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path
        d="M2 9v2.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M7 1.5v7M4.5 6.5 7 9l2.5-2.5"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24"
      fill="none" aria-hidden="true" focusable="false">
      <rect x="5" y="11" width="14" height="10" rx="2"
        stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}