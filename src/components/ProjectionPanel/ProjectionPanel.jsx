// ── ProjectionPanel.jsx ───────────────────────────────────────────────────────
// Collapsible right-panel section with two calculators:
//
// 1. Backward Projection — "What GPA do I need each semester to reach X.XX?"
//    Inputs:  Target CGPA, remaining semesters, estimated CU per semester
//    Outputs: Required GPA per semester, feasibility rating
//
// 2. Forward Simulation — "What will my CGPA be if I get X.XX next semester?"
//    Inputs:  Next semester GPA, next semester credit units
//    Outputs: Projected CGPA, new degree class, delta from current
//
// All backward-projection arithmetic is in useCGPA (via projection.js) and
// arrives as the `projectionResult` prop. Forward simulation is computed
// locally because it is display-only state that does not need to be persisted.


import React, { useState, useMemo, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { computeForwardSimulation } from "../../utils/projection.js";
import { ClassBadgeCompact }        from "../CGPASummary/ClassBadge.jsx";
import "./ProjectionPanel.css";


// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectionPanel({
  projection,
  projectionResult,
  totals,
  activeScale,
  activeGradeTable,
  activeClassifications,
  onSetProjection,
}) {
  const [expanded, setExpanded] = useState(true);

  // Forward simulator local state
  const [nextGPA, setNextGPA] = useState("");
  const [nextCU,  setNextCU]  = useState("");

  const hasCurrentData  = totals.totalCU > 0;
  const currentCGPA     = hasCurrentData
    ? Math.round((totals.totalQP / totals.totalCU) * 10000) / 10000
    : null;

  // Effective CU for forward simulation: typed value → estimated CU → 18
  const effectiveNextCU = useMemo(() => {
    const typed     = parseFloat(nextCU);
    const estimated = parseFloat(projection.estimatedCUPerSemester);
    if (!isNaN(typed) && typed > 0)     return typed;
    if (!isNaN(estimated) && estimated > 0) return estimated;
    return 18;
  }, [nextCU, projection.estimatedCUPerSemester]);

  // Forward simulation result (computed locally)
  const forwardResult = useMemo(() => {
    const gpa = parseFloat(nextGPA);
    if (isNaN(gpa) || gpa < 0 || gpa > activeScale) return null;
    if (!hasCurrentData) return null;
    return computeForwardSimulation({
      currentTotalCU:    totals.totalCU,
      currentTotalQP:    totals.totalQP,
      nextSemGPA:        gpa,
      nextSemCU:         effectiveNextCU,
      classifications:   activeClassifications,
    });
  }, [nextGPA, effectiveNextCU, totals, activeScale, activeClassifications, hasCurrentData]);

  return (
    <div className="projection-panel panel-card">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="collapsible-header projection-panel__header"
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((p) => !p);
          }
        }}
      >
        <div className="projection-panel__title-row">
          <span className="collapsible-header__title">Grade Projections</span>
          {currentCGPA !== null && (
            <span className="projection-panel__current-badge">
              Current: {currentCGPA.toFixed(2)}
            </span>
          )}
        </div>
        <svg
          className={`collapsible-chevron${expanded ? " collapsible-chevron--open" : ""}`}
          width="16" height="16" viewBox="0 0 16 16"
          fill="none" aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="projection-panel__body">

          {/* ── Section 1: Backward projection ─────────────────────────── */}
          <BackwardSection
            projection={projection}
            projectionResult={projectionResult}
            activeScale={activeScale}
            onSetProjection={onSetProjection}
            currentCGPA={currentCGPA}
          />

          {/* ── Section 2: Forward simulation ──────────────────────────── */}
          {hasCurrentData && (
            <ForwardSection
              nextGPA={nextGPA}
              nextCU={nextCU}
              effectiveNextCU={effectiveNextCU}
              forwardResult={forwardResult}
              activeScale={activeScale}
              currentCGPA={currentCGPA}
              onNextGPAChange={setNextGPA}
              onNextCUChange={setNextCU}
            />
          )}

          {/* Prompt to enter data when nothing entered yet */}
          {!hasCurrentData && (
            <p className="projection-panel__no-data">
              Enter your courses first. Projections use your current totals
              as the starting point.
            </p>
          )}

        </div>
      )}

    </div>
  );
}


// ── Backward section ──────────────────────────────────────────────────────────

function BackwardSection({
  projection,
  projectionResult,
  activeScale,
  onSetProjection,
  currentCGPA,
}) {
  const [targetError, setTargetError]   = useState("");
  const [semsError,   setSemsError]     = useState("");
  const [cuError,     setCUError]       = useState("");

  function handleTargetChange(e) {
    const raw = e.target.value;
    onSetProjection({ targetCGPA: raw === "" ? null : parseFloat(raw) });
    if (targetError) setTargetError("");
  }

  function handleTargetBlur(e) {
    const val = parseFloat(e.target.value);
    if (e.target.value !== "" && (isNaN(val) || val <= 0 || val > activeScale)) {
      setTargetError(`Must be between 0.01 and ${activeScale.toFixed(1)}.`);
    } else {
      setTargetError("");
    }
  }

  function handleSemsChange(e) {
    const raw = e.target.value;
    const n   = parseInt(raw, 10);
    onSetProjection({ remainingSemesters: raw === "" ? null : isNaN(n) ? null : n });
    if (semsError) setSemsError("");
  }

  function handleSemsBlur(e) {
    const n = parseInt(e.target.value, 10);
    if (e.target.value !== "" && (isNaN(n) || n < 0 || !Number.isInteger(n))) {
      setSemsError("Must be 0 or more.");
    } else {
      setSemsError("");
    }
  }

  function handleCUChange(e) {
    const raw = e.target.value;
    const n   = parseFloat(raw);
    onSetProjection({ estimatedCUPerSemester: raw === "" ? null : isNaN(n) ? null : n });
    if (cuError) setCUError("");
  }

  function handleCUBlur(e) {
    const n = parseFloat(e.target.value);
    if (e.target.value !== "" && (isNaN(n) || n <= 0)) {
      setCUError("Must be greater than 0.");
    } else {
      setCUError("");
    }
  }

  const targetVal = projection.targetCGPA    !== null ? String(projection.targetCGPA)            : "";
  const semsVal   = projection.remainingSemesters !== null ? String(projection.remainingSemesters) : "";
  const cuVal     = projection.estimatedCUPerSemester !== null
    ? String(projection.estimatedCUPerSemester)
    : "";

  return (
    <div className="projection-section">
      <p className="projection-section__label label">Target CGPA</p>

      {/* Three inputs */}
      <div className="projection-inputs">

        <ProjectionInput
          id="proj-target"
          label="Target CGPA"
          value={targetVal}
          onChange={handleTargetChange}
          onBlur={handleTargetBlur}
          error={targetError}
          placeholder={`0–${activeScale.toFixed(1)}`}
          tooltip={`Enter the CGPA you want to achieve by graduation. Maximum for this institution is ${activeScale.toFixed(1)}.`}
          step="0.01"
          min="0.01"
          max={String(activeScale)}
        />

        <ProjectionInput
          id="proj-sems"
          label="Remaining Sems"
          value={semsVal}
          onChange={handleSemsChange}
          onBlur={handleSemsBlur}
          error={semsError}
          placeholder="e.g. 4"
          tooltip="How many semesters do you have left before graduation?"
          step="1"
          min="0"
        />

        <ProjectionInput
          id="proj-cu"
          label="CU / Semester"
          value={cuVal}
          onChange={handleCUChange}
          onBlur={handleCUBlur}
          error={cuError}
          placeholder="e.g. 18"
          tooltip="Estimated credit units you will take each remaining semester. Most semesters carry 15 to 24."
          step="1"
          min="1"
        />

      </div>

      {/* Result */}
      <ProjectionResult
        result={projectionResult}
        activeScale={activeScale}
        currentCGPA={currentCGPA}
        targetCGPA={projection.targetCGPA}
      />

    </div>
  );
}


// ── Projection result ─────────────────────────────────────────────────────────

function ProjectionResult({ result, activeScale, currentCGPA, targetCGPA }) {

  // No inputs provided yet
  if (!result && (targetCGPA === null)) {
    return (
      <div className="projection-result projection-result--prompt">
        <p className="projection-result__prompt">
          Enter a target CGPA, remaining semesters, and estimated credit units
          to see what you need per semester.
        </p>
      </div>
    );
  }

  // Inputs have validation errors — result will be null
  if (!result) return null;

  // No semesters remaining
  if (result.noSemestersRemaining) {
    return (
      <div className="projection-result projection-result--info">
        <p className="projection-result__message">
          {result.targetMet
            ? `You have already met your target CGPA of ${result.targetCGPA.toFixed(2)}.`
            : `No remaining semesters. Current CGPA is ${result.currentCGPA?.toFixed(2) ?? "—"}.
               Target was ${result.targetCGPA.toFixed(2)}.`}
        </p>
      </div>
    );
  }

  // Not achievable
  if (result.feasibility === "not_achievable") {
    return (
      <div className="projection-result projection-result--danger">
        <div className="projection-result__icon-row">
          <IconAlert />
          <span className="projection-result__title">Not achievable</span>
        </div>
        <p className="projection-result__message">
          Even with maximum grades in every remaining semester, you can only
          reach a CGPA of{" "}
          <strong>{result.maxReachableCGPA?.toFixed(2) ?? "—"}</strong>.
        </p>
        <p className="projection-result__hint">
          Consider adjusting your target or reviewing your remaining semesters.
        </p>
      </div>
    );
  }

  // Valid result — show required GPA
  return (
    <div className="projection-result projection-result--valid">

      <div className="projection-result__required">
        <div className="projection-result__required-top">
          <span className="projection-result__required-label label">
            Required GPA per semester
          </span>
          <FeasibilityBadge feasibility={result.feasibility} />
        </div>

        <div className="projection-result__required-number">
          <span
            className="projection-result__gpa"
            style={{ color: getRequiredGPAColor(result.requiredGPAPerSemester, activeScale) }}
          >
            {result.requiredGPAPerSemester?.toFixed(2) ?? "—"}
          </span>
          <span className="projection-result__gpa-scale">
            / {activeScale.toFixed(1)}
          </span>
        </div>

        <p className="projection-result__context">
          {result.feasibilityLabel}
        </p>
      </div>

    </div>
  );
}


// ── Feasibility badge ─────────────────────────────────────────────────────────

function FeasibilityBadge({ feasibility }) {
  const config = {
    achievable:       { label: "Achievable",         mod: "success"  },
    challenging:      { label: "Challenging",         mod: "warning"  },
    very_challenging: { label: "Very Challenging",    mod: "danger-warning" },
    not_achievable:   { label: "Not Achievable",      mod: "danger"   },
    achieved:         { label: "Already Achieved",    mod: "success"  },
  }[feasibility] || { label: feasibility, mod: "neutral" };

  return (
    <span className={`feasibility-badge feasibility-badge--${config.mod}`}>
      {config.label}
    </span>
  );
}

function getRequiredGPAColor(required, scaleMax) {
  if (required === null || required === undefined) return "var(--color-text-muted)";
  const ratio = required / scaleMax;
  if (ratio > 1)    return "var(--color-danger)";
  if (ratio > 0.90) return "var(--color-danger)";
  if (ratio > 0.75) return "var(--color-warning)";
  return "var(--color-success)";
}


// ── Forward section ───────────────────────────────────────────────────────────

function ForwardSection({
  nextGPA,
  nextCU,
  effectiveNextCU,
  forwardResult,
  activeScale,
  currentCGPA,
  onNextGPAChange,
  onNextCUChange,
}) {
  const [gpaError, setGPAError] = useState("");

  function handleGPAChange(e) {
    onNextGPAChange(e.target.value);
    if (gpaError) setGPAError("");
  }

  function handleGPABlur(e) {
    const val = parseFloat(e.target.value);
    if (e.target.value !== "" && (isNaN(val) || val < 0 || val > activeScale)) {
      setGPAError(`GPA must be between 0 and ${activeScale.toFixed(1)}.`);
    } else {
      setGPAError("");
    }
  }

  return (
    <div className="projection-section projection-section--forward">
      <hr className="divider projection-section__divider" />
      <p className="projection-section__label label">What If?</p>

      <div className="forward-inputs">
        <ProjectionInput
          id="fwd-gpa"
          label="Next Semester GPA"
          value={nextGPA}
          onChange={handleGPAChange}
          onBlur={handleGPABlur}
          error={gpaError}
          placeholder={`0–${activeScale.toFixed(1)}`}
          tooltip="Enter the GPA you expect to achieve next semester."
          step="0.01"
          min="0"
          max={String(activeScale)}
        />

        <ProjectionInput
          id="fwd-cu"
          label={`CU (default: ${effectiveNextCU})`}
          value={nextCU}
          onChange={(e) => onNextCUChange(e.target.value)}
          placeholder={String(effectiveNextCU)}
          tooltip="Credit units for next semester. Leave blank to use your estimated CU from above."
          step="1"
          min="1"
        />
      </div>

      {/* Forward result */}
      {forwardResult?.valid && (
        <ForwardResult
          result={forwardResult}
          currentCGPA={currentCGPA}
          activeScale={activeScale}
        />
      )}

      {!forwardResult && nextGPA !== "" && (
        <p className="forward-prompt">
          Enter a valid GPA between 0 and {activeScale.toFixed(1)}.
        </p>
      )}

      {!nextGPA && (
        <p className="forward-prompt">
          Enter what you expect to score next semester.
        </p>
      )}
    </div>
  );
}


// ── Forward result ────────────────────────────────────────────────────────────

function ForwardResult({ result, currentCGPA, activeScale }) {
  const { projectedCGPA, projectedClass, delta, direction } = result;

  const deltaDisplay = delta >= 0
    ? `+${delta.toFixed(2)}`
    : delta.toFixed(2);

  const directionColor = direction === "up"
    ? "var(--color-success)"
    : direction === "down"
    ? "var(--color-danger)"
    : "var(--color-text-muted)";

  return (
    <div className="forward-result">
      <div className="forward-result__main">
        <div className="forward-result__display">
          <span className="forward-result__label label">Projected CGPA</span>
          <div className="forward-result__numbers">
            <span className="forward-result__cgpa">
              {projectedCGPA.toFixed(2)}
            </span>
            <span
              className="forward-result__delta"
              style={{ color: directionColor }}
              aria-label={`Change: ${deltaDisplay}`}
            >
              {deltaDisplay}
            </span>
          </div>
        </div>

        {projectedClass && (
          <div className="forward-result__class">
            <ClassBadgeCompact entry={projectedClass} />
          </div>
        )}
      </div>

      {/* Comparison to current */}
      {currentCGPA !== null && (
        <p className="forward-result__compare">
          {direction === "up"
            ? `Up from ${currentCGPA.toFixed(2)} — this semester moves you forward.`
            : direction === "down"
            ? `Down from ${currentCGPA.toFixed(2)} — this result would lower your CGPA.`
            : `Your CGPA would stay the same at ${currentCGPA.toFixed(2)}.`}
        </p>
      )}
    </div>
  );
}


// ── Projection input field ────────────────────────────────────────────────────

function ProjectionInput({
  id, label, value, onChange, onBlur,
  error, placeholder, tooltip, step = "any", min, max,
}) {
  const [visible, setVisible]   = useState(false);
  const [pos, setPos]           = useState({ top: 0, left: 0 });
  const iconRef                 = useRef(null);

  function openTooltip() {
    if (!iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    const TW = 220;
    let left = r.left;
    if (left + TW > window.innerWidth - 12) left = window.innerWidth - TW - 12;
    if (left < 12) left = 12;
    setPos({ top: r.bottom + 6, left });
    setVisible(true);
  }

  return (
    <div className="proj-input">
      <div className="proj-input__label-row">
        <label className="label proj-input__label" htmlFor={id}>
          {label}
        </label>
        {tooltip && (
          <span
            ref={iconRef}
            className="proj-input__tooltip-icon"
            aria-label="More info"
            tabIndex={0}
            onMouseEnter={openTooltip}
            onMouseLeave={() => setVisible(false)}
            onFocus={openTooltip}
            onBlur={() => setVisible(false)}
          >
            <IconInfo />
          </span>
        )}
      </div>

      <input
        id={id}
        type="number"
        className={`input-base proj-input__field${error ? " input-base--error" : ""}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-err` : undefined}
      />

      {error && (
        <span id={`${id}-err`} className="proj-input__error" role="alert">
          {error}
        </span>
      )}

      {visible && tooltip && createPortal(
        <div
          className="proj-tooltip-fixed"
          style={{ top: pos.top, left: pos.left }}
          role="tooltip"
        >
          {tooltip}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconInfo() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12"
      fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5"
        stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 5.5v3"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <circle cx="6" cy="4" r="0.65" fill="currentColor" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true">
      <path d="M8 2L14.5 13H1.5L8 2z"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6v3.5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
    </svg>
  );
}