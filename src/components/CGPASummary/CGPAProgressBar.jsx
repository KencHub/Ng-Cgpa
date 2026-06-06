// ── CGPAProgressBar.jsx ───────────────────────────────────────────────────────
// A horizontal progress bar showing the student's CGPA position on the scale.
//
// Features:
//   — Coloured fill matching the current degree class
//   — Classification boundary tick marks with labels above the track
//   — White dot marker at the right edge of the fill for exact position
//   — CSS transition so the bar animates when CGPA changes
//   — Accessible via aria-valuenow / aria-valuemax
//
// CSS lives in CGPASummary.css.


import React, { useMemo } from "react";
import { getClassMod } from "./ClassBadge.jsx";


// ── Degree class fill colours ─────────────────────────────────────────────────

const CLASS_FILL_COLORS = {
  first:  "var(--color-class-first)",
  upper:  "var(--color-class-upper)",
  lower:  "var(--color-class-lower)",
  third:  "var(--color-class-third)",
  pass:   "var(--color-class-pass)",
  fail:   "var(--color-class-none)",
};

function getFillColor(classEntry) {
  if (!classEntry) return "var(--color-border-strong)";
  const mod = getClassMod(classEntry.short);
  return CLASS_FILL_COLORS[mod] || "var(--color-text-muted)";
}


// ── Main component ────────────────────────────────────────────────────────────

export default function CGPAProgressBar({
  cgpa,
  scaleMax,
  classEntry,
  classifications,
}) {
  const hasCGPA    = cgpa !== null && cgpa !== undefined;
  const fillColor  = getFillColor(classEntry);
  const fillPct    = hasCGPA
    ? Math.min(100, Math.max(0, (cgpa / scaleMax) * 100))
    : 0;

  // Build tick data from classification boundaries
  const ticks = useMemo(() => {
    if (!Array.isArray(classifications) || classifications.length === 0) {
      return [];
    }

    return classifications
      .filter((c) => c.min > 0 && c.min < scaleMax)
      .map((c) => ({
        min:   c.min,
        label: c.short || c.label,
        pct:   (c.min / scaleMax) * 100,
      }))
      .sort((a, b) => a.min - b.min);
  }, [classifications, scaleMax]);

  // Which tick (if any) is the next boundary above current CGPA?
  // We'll highlight it subtly.
  const nextBoundary = useMemo(() => {
    if (!hasCGPA) return null;
    const sorted = [...ticks].sort((a, b) => a.min - b.min);
    return sorted.find((t) => t.min > cgpa) || null;
  }, [ticks, hasCGPA, cgpa]);

  return (
    <div
      className="cgpa-progress"
      role="progressbar"
      aria-valuenow={hasCGPA ? cgpa : 0}
      aria-valuemin={0}
      aria-valuemax={scaleMax}
      aria-label={
        hasCGPA
          ? `CGPA progress: ${cgpa.toFixed(2)} out of ${scaleMax.toFixed(1)}`
          : "No CGPA data"
      }
    >
      {/* ── Tick labels above track ──────────────────────────────────────── */}
      {ticks.length > 0 && (
        <div className="cgpa-progress__ticks-row" aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick.min}
              className="cgpa-progress__tick-label"
              style={{ left: `${tick.pct}%` }}
              title={`${tick.label}: ${tick.min.toFixed(2)}+`}
            >
              {tick.min.toFixed(tick.min % 1 === 0 ? 0 : 2)}
            </span>
          ))}
        </div>
      )}

      {/* ── Track ────────────────────────────────────────────────────────── */}
      <div className="cgpa-progress__track">

        {/* Filled portion */}
        <div
          className="cgpa-progress__fill"
          style={{
            width:           `${fillPct}%`,
            backgroundColor: fillColor,
            color:           fillColor, /* marker uses currentColor */
          }}
        />

        {/* Tick marks on the track */}
        {ticks.map((tick) => (
          <div
            key={tick.min}
            className="cgpa-progress__tick-mark"
            style={{ left: `${tick.pct}%` }}
            aria-hidden="true"
          />
        ))}

      </div>

      {/* ── Scale labels below track ──────────────────────────────────────── */}
      <div className="cgpa-progress__labels-row" aria-hidden="true">
        <span className="cgpa-progress__label-min">0.00</span>

        {/* Show next boundary as a nudge if CGPA is within 0.10 */}
        {nextBoundary && hasCGPA && (nextBoundary.min - cgpa) <= 0.10 && (
          <span
            style={{
              fontSize:   "10px",
              color:      "var(--color-text-secondary)",
              fontWeight: "600",
              position:   "absolute",
              left:       `${nextBoundary.pct}%`,
              bottom:     0,
              transform:  "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {nextBoundary.label} ↑
          </span>
        )}

        <span className="cgpa-progress__label-max">{scaleMax.toFixed(1)}</span>
      </div>

    </div>
  );
}