// ── App.jsx ───────────────────────────────────────────────────────────────────
// Root component. Orchestrates all hooks and renders the component tree.
// No business logic lives here — this file is pure composition.


import React, { useMemo, useState } from "react";

import { useCGPA }        from "./hooks/useCGPA.js";
import { usePersistence } from "./hooks/usePersistence.js";
import { useChat }        from "./hooks/useChat.js";

import { generateAndDownloadPDF } from "./utils/exportPDF.js";
import {
  buildTextSummary,
  downloadTextSummary,
  copyTextToClipboard,
} from "./utils/exportText.js";
import {
  exportAndDownloadJSON,
  importFromJSON,
} from "./utils/exportJSON.js";

// Components — built in batches 12–27
import Header             from "./components/Header/Header.jsx";
import Footer             from "./components/Footer/Footer.jsx";
import StudentProfileBar  from "./components/StudentProfileBar/StudentProfileBar.jsx";
import SemesterTabs       from "./components/SemesterTabs/SemesterTabs.jsx";
import SemesterPanel      from "./components/SemesterPanel/SemesterPanel.jsx";
import SuggestionEngine   from "./components/SuggestionEngine/SuggestionEngine.jsx";
import CGPASummary        from "./components/CGPASummary/CGPASummary.jsx";
import ProjectionPanel    from "./components/ProjectionPanel/ProjectionPanel.jsx";
import ImprovementChat    from "./components/ImprovementChat/ImprovementChat.jsx";
import InstitutionModal   from "./components/Modals/InstitutionModal.jsx";
import ImportModal        from "./components/Modals/ImportModal.jsx";
import ClearConfirmDialog from "./components/Modals/ClearConfirmDialog.jsx";
import HelpCenter         from "./components/HelpCenter/HelpCenter.jsx";

import "./App.css";


// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const cgpa = useCGPA();

  const persistence = usePersistence(cgpa);

  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const chat = useChat({
    institution:           cgpa.institution,
    student:               cgpa.student,
    semesters:             cgpa.semesters,
    cgpa:                  cgpa.cgpa,
    degreeClass:           cgpa.degreeClass,
    semesterSummaries:     cgpa.semesterSummaries,
    totals:                cgpa.totals,
    activeScale:           cgpa.activeScale,
    activeClassifications: cgpa.activeClassifications,
  });


  // ── Derived convenience values ──────────────────────────────────────────────

  const completedSemesterCount = useMemo(
    () => cgpa.semesters.filter((s) => s.courses.length > 0).length,
    [cgpa.semesters]
  );

  const totalCourseCount = useMemo(
    () => cgpa.semesters.reduce((acc, s) => acc + s.courses.length, 0),
    [cgpa.semesters]
  );

  const hasAnyData = useMemo(
    () => cgpa.institution !== null || cgpa.semesters.length > 0,
    [cgpa.institution, cgpa.semesters]
  );


  // ── Export handlers ─────────────────────────────────────────────────────────

  function handleExportPDF() {
    persistence.flushSave();
    generateAndDownloadPDF({
      institution:       cgpa.institution,
      student:           cgpa.student,
      semesters:         cgpa.semesters,
      cgpa:              cgpa.cgpa,
      degreeClass:       cgpa.degreeClass,
      semesterSummaries: cgpa.semesterSummaries,
      totalCU:           cgpa.totals.totalCU,
      totalQP:           cgpa.totals.totalQP,
      useUILegacyScale:  cgpa.useUILegacyScale,
    });
  }

  function handleExportJSON() {
    persistence.flushSave();
    exportAndDownloadJSON({
      institution:       cgpa.institution,
      student:           cgpa.student,
      semesters:         cgpa.semesters,
      cgpa:              cgpa.cgpa,
      degreeClass:       cgpa.degreeClass,
      projection:        cgpa.projection,
      useUILegacyScale:  cgpa.useUILegacyScale,
    });
  }

  function handleExportText() {
    const text = buildTextSummary({
      institution:       cgpa.institution,
      student:           cgpa.student,
      semesters:         cgpa.semesters,
      cgpa:              cgpa.cgpa,
      degreeClass:       cgpa.degreeClass,
      semesterSummaries: cgpa.semesterSummaries,
      totalCU:           cgpa.totals.totalCU,
      totalQP:           cgpa.totals.totalQP,
      useUILegacyScale:  cgpa.useUILegacyScale,
    });
    copyTextToClipboard(text);
  }

  function handleDownloadText() {
    const text = buildTextSummary({
      institution:       cgpa.institution,
      student:           cgpa.student,
      semesters:         cgpa.semesters,
      cgpa:              cgpa.cgpa,
      degreeClass:       cgpa.degreeClass,
      semesterSummaries: cgpa.semesterSummaries,
      totalCU:           cgpa.totals.totalCU,
      totalQP:           cgpa.totals.totalQP,
      useUILegacyScale:  cgpa.useUILegacyScale,
    });
    downloadTextSummary(text, cgpa.institution?.id, cgpa.student?.name);
  }


  // ── Import JSON handler ─────────────────────────────────────────────────────

  function handleImportJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = importFromJSON(e.target.result);
      if (result.success) {
        cgpa.loadFromSaved(result.state);
      } else {
        console.warn("[NG CGPA] JSON import failed:", result.error);
      }
    };
    reader.readAsText(file);
  }


  // ── Loading screen ──────────────────────────────────────────────────────────

  if (!persistence.ready) {
    return <AppLoadingScreen />;
  }


  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Header
        institution={cgpa.institution}
        useUILegacyScale={cgpa.useUILegacyScale}
        onOpenSchoolModal={() => cgpa.openModal("schoolModalOpen")}
        onOpenInfo={() => setInfoModalOpen(true)}
        onOpenHelp={() => cgpa.openModal("helpCenterOpen")}
        onOpenImport={() => cgpa.openModal("importModalOpen")}
        onExportPDF={handleExportPDF}
        onExportJSON={handleExportJSON}
        onExportText={handleExportText}
        onDownloadText={handleDownloadText}
        onImportJSON={handleImportJSON}
        onClearData={() => cgpa.openModal("clearConfirmOpen")}
        hasData={hasAnyData}
        storageAvailable={persistence.storageAvailable}
      />


      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <main className="main-layout" id="main-content">

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div className="left-panel">

          <StudentProfileBar
            student={cgpa.student}
            onUpdate={cgpa.updateStudent}
          />

          <SemesterTabs
            semesters={cgpa.semesters}
            activeTab={cgpa.activeTab}
            onSetActive={cgpa.setActiveTab}
            onAdd={cgpa.addSemester}
          />

          {cgpa.semesters.length > 0 && cgpa.activeSemester ? (
            <SemesterPanel
              semester={cgpa.activeSemester}
              institution={cgpa.institution}
              activeGradeTable={cgpa.activeGradeTable}
              activePassmark={cgpa.activePassmark}
              onAddCourse={cgpa.addCourse}
              onRemoveCourse={cgpa.removeCourse}
              onUpdateCourse={cgpa.updateCourse}
              onRename={cgpa.renameSemester}
              onRemoveSemester={cgpa.removeSemester}
              onClearSemester={cgpa.clearSemester}
              onToggleCollapse={cgpa.toggleSemesterCollapse}
              onOpenImport={() => cgpa.openModal("importModalOpen")}
            />
          ) : (
            <EmptyStart
              onSelectInstitution={() => cgpa.openModal("schoolModalOpen")}
              onAddSemester={cgpa.addSemester}
              hasInstitution={cgpa.institution !== null}
            />
          )}

          <SuggestionEngine
            suggestions={cgpa.suggestions}
            onDismiss={cgpa.dismissSuggestion}
          />

        </div>


        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div className="right-panel">

          <CGPASummary
            cgpa={cgpa.cgpa}
            degreeClass={cgpa.degreeClass}
            degreeClassShort={cgpa.degreeClassShort}
            degreeClassEntry={cgpa.degreeClassEntry}
            totals={cgpa.totals}
            semesterCount={completedSemesterCount}
            courseCount={totalCourseCount}
            scaleMax={cgpa.activeScale}
            institution={cgpa.institution}
            semesterSummaries={cgpa.semesterSummaries}
          />

          <ProjectionPanel
            projection={cgpa.projection}
            projectionResult={cgpa.projectionResult}
            totals={cgpa.totals}
            activeScale={cgpa.activeScale}
            activeGradeTable={cgpa.activeGradeTable}
            activeClassifications={cgpa.activeClassifications}
            onSetProjection={cgpa.setProjection}
          />

          <ImprovementChat
            messages={chat.messages}
            isLoading={chat.isLoading}
            pendingRetry={chat.pendingRetry}
            isAPIOnline={chat.isAPIOnline}
            suggestedChips={chat.suggestedChips}
            onSend={chat.sendMessage}
            onRetry={chat.retryMessage}
            onDismissError={chat.dismissError}
            onClear={chat.clearChat}
            hasData={hasAnyData}
            institution={cgpa.institution}
            cgpa={cgpa.cgpa}
          />

        </div>

      </main>


      {/* ── Mobile sticky CGPA bar ─────────────────────────────────────────── */}
      <MobileCGPABar
        cgpa={cgpa.cgpa}
        degreeClassShort={cgpa.degreeClassShort}
        degreeClassEntry={cgpa.degreeClassEntry}
        scaleMax={cgpa.activeScale}
        semesterCount={completedSemesterCount}
      />


      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <Footer />


      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {cgpa.ui.schoolModalOpen && (
        <InstitutionModal
          institution={cgpa.institution}
          useUILegacyScale={cgpa.useUILegacyScale}
          onSelect={(inst) => {
            cgpa.setInstitution(inst);
            cgpa.closeModal("schoolModalOpen");
          }}
          onToggleLegacy={cgpa.toggleUILegacyScale}
          onClose={() => cgpa.closeModal("schoolModalOpen")}
        />
      )}

      {infoModalOpen && cgpa.institution && (
        <InstitutionModal
          institution={cgpa.institution}
          useUILegacyScale={cgpa.useUILegacyScale}
          onSelect={null}
          onToggleLegacy={cgpa.toggleUILegacyScale}
          onClose={() => setInfoModalOpen(false)}
          infoOnly
        />
      )}

      {cgpa.ui.importModalOpen && (
        <ImportModal
          semesters={cgpa.semesters}
          activeTab={cgpa.activeTab}
          activeGradeTable={cgpa.activeGradeTable}
          institution={cgpa.institution}
          onImport={cgpa.importCoursesToSemester}
          onAddSemester={cgpa.addSemester}
          onSetSemesterLabel={cgpa.setSemesterLabel}
          onClose={() => cgpa.closeModal("importModalOpen")}
        />
      )}

      {cgpa.ui.clearConfirmOpen && (
        <ClearConfirmDialog
          onConfirm={() => {
            persistence.clearAndReset();
            cgpa.closeModal("clearConfirmOpen");
          }}
          onCancel={() => cgpa.closeModal("clearConfirmOpen")}
        />
      )}

      {cgpa.ui.helpCenterOpen && (
        <HelpCenter
          onClose={() => cgpa.closeModal("helpCenterOpen")}
        />
      )}

    </div>
  );
}


// ── Inline helper components ──────────────────────────────────────────────────

function AppLoadingScreen() {
  return (
    <div className="app-loading">
      <div className="app-loading__inner">
        <div className="app-loading__logo">NG CGPA</div>
        <div className="app-loading__spinner" aria-label="Loading" />
        <p className="app-loading__text">Loading your data...</p>
      </div>

      <style>{`
        .app-loading {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-surface);
        }
        .app-loading__inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
        }
        .app-loading__logo {
          font-size: 28px;
          font-weight: var(--font-weight-bold);
          color: var(--color-primary);
          letter-spacing: -0.02em;
        }
        .app-loading__spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .app-loading__text {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}


function EmptyStart({ onSelectInstitution, onAddSemester, hasInstitution }) {
  return (
    <div className="empty-start panel-card">
      <div className="empty-start__inner">

        <div className="empty-start__icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="var(--color-surface-2)" />
            <path
              d="M14 30 L24 20 L34 30"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="18" y="30" width="12" height="9" rx="2"
              fill="var(--color-primary)" opacity="0.7" />
            <rect x="22" y="17" width="4" height="4" rx="2"
              fill="var(--color-accent)" />
          </svg>
        </div>

        <h2 className="empty-start__heading">Welcome to NG CGPA</h2>

        {!hasInstitution ? (
          <>
            <p className="empty-start__text">
              Select your university to begin. The app will use your institution's
              official grading scale and classification thresholds.
            </p>
            <button
              className="btn btn-primary"
              onClick={onSelectInstitution}
            >
              Select University
            </button>
          </>
        ) : (
          <>
            <p className="empty-start__text">
              Your university is set. Add your first semester to start entering courses.
            </p>
            <button
              className="btn btn-primary"
              onClick={onAddSemester}
            >
              Add First Semester
            </button>
          </>
        )}
      </div>

      <style>{`
        .empty-start {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 280px;
          padding: var(--space-8) var(--space-6);
        }
        .empty-start__inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          max-width: 320px;
          text-align: center;
        }
        .empty-start__heading {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
        }
        .empty-start__text {
          font-size: var(--font-size-base);
          color: var(--color-text-secondary);
          line-height: var(--line-height-relaxed);
        }
      `}</style>
    </div>
  );
}


function MobileCGPABar({ cgpa, degreeClassShort, degreeClassEntry, scaleMax, semesterCount }) {
  if (cgpa === null) return null;

  const classColor = degreeClassEntry
    ? getClassColorVar(degreeClassEntry.short)
    : "var(--color-accent)";

  return (
    <div className="cgpa-sticky-bar" role="status" aria-label="Current CGPA">
      <div className="cgpa-sticky-bar__left">
        <span className="cgpa-sticky-bar__label">CGPA</span>
        <span
          className="cgpa-sticky-bar__value"
          style={{ color: classColor }}
        >
          {cgpa.toFixed(2)}
        </span>
        <span className="cgpa-sticky-bar__scale">/ {scaleMax.toFixed(1)}</span>
      </div>

      <div className="cgpa-sticky-bar__right">
        {degreeClassShort && (
          <span
            className="cgpa-sticky-bar__class"
            style={{ color: classColor }}
          >
            {degreeClassShort}
          </span>
        )}
        <span className="cgpa-sticky-bar__sems">
          {semesterCount} {semesterCount === 1 ? "sem" : "sems"}
        </span>
      </div>

      <style>{`
        .cgpa-sticky-bar__left {
          display: flex;
          align-items: baseline;
          gap: var(--space-2);
        }
        .cgpa-sticky-bar__label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-label);
          color: rgba(255,255,255,0.65);
        }
        .cgpa-sticky-bar__value {
          font-size: 22px;
          font-weight: var(--font-weight-bold);
          letter-spacing: var(--letter-spacing-cgpa);
        }
        .cgpa-sticky-bar__scale {
          font-size: var(--font-size-sm);
          color: rgba(255,255,255,0.55);
        }
        .cgpa-sticky-bar__right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .cgpa-sticky-bar__class {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-bold);
        }
        .cgpa-sticky-bar__sems {
          font-size: var(--font-size-sm);
          color: rgba(255,255,255,0.55);
        }
      `}</style>
    </div>
  );
}


// ── Color helper for class badges ─────────────────────────────────────────────

function getClassColorVar(short) {
  if (!short) return "var(--color-accent)";
  const s = short.toLowerCase();
  if (s.includes("first"))                        return "var(--color-class-first)";
  if (s.includes("2:1") || s.includes("upper"))   return "#A8D5B5";
  if (s.includes("2:2") || s.includes("lower"))   return "var(--color-accent)";
  if (s.includes("third"))                        return "#F4C46A";
  return "rgba(255,255,255,0.80)";
}