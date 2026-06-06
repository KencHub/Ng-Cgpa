// ── ClassBadge.jsx ────────────────────────────────────────────────────────────
// Renders the degree classification badge for a student's current CGPA.
//
// Props:
//   entry   — the classification entry object: { min, max, label, short }
//   compact — boolean, renders a smaller pill variant (default: false)
//
// The colour modifier is derived from entry.short so custom schools with
// non-standard short labels degrade gracefully to the "pass" neutral style.
//
// CSS lives in CGPASummary.css.


import React from "react";


// ── Modifier map ──────────────────────────────────────────────────────────────

const MOD_RULES = [
  { test: (s) => s.includes("first"),                     mod: "first"  },
  { test: (s) => s.includes("2:1") || s.includes("upper"), mod: "upper"  },
  { test: (s) => s.includes("2:2") || s.includes("lower"), mod: "lower"  },
  { test: (s) => s.includes("third"),                     mod: "third"  },
  { test: (s) => s.includes("pass"),                      mod: "pass"   },
  { test: (s) => s.includes("fail") || s.includes("no degree"), mod: "fail" },
];

function getClassMod(short) {
  if (!short) return "pass";
  const lower = short.toLowerCase();
  for (const rule of MOD_RULES) {
    if (rule.test(lower)) return rule.mod;
  }
  return "pass";
}


// ── Main component ────────────────────────────────────────────────────────────

export default function ClassBadge({ entry, compact = false }) {
  if (!entry) return null;

  const mod = getClassMod(entry.short);

  return (
    <div
      className={`class-badge class-badge--${mod}${compact ? " class-badge--compact" : ""}`}
      role="status"
      aria-label={`Degree classification: ${entry.label}`}
    >
      <span className="class-badge__full">
        {entry.label}
      </span>

      {!compact && entry.short && entry.short !== entry.label && (
        <span className="class-badge__code" aria-hidden="true">
          {entry.short}
        </span>
      )}
    </div>
  );
}


// ── Named export for compact inline usage ─────────────────────────────────────
// Used by ProjectionPanel to show the projected class in a small pill.

export function ClassBadgeCompact({ entry }) {
  return <ClassBadge entry={entry} compact />;
}


// ── Utility export ────────────────────────────────────────────────────────────
// Lets other components compute the class modifier without rendering the badge.

export { getClassMod };