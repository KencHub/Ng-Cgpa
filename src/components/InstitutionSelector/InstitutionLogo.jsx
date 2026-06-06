// ── InstitutionLogo.jsx ───────────────────────────────────────────────────────
// Resolves and renders an institution logo through four priority layers.
// All fallback logic is internal. No parent component handles errors.
//
// Priority 1: User-uploaded logo stored in localStorage as a data URL
// Priority 2: logoUrl from the institution registry (with onerror fallback)
// Priority 3: SVG initials badge with a deterministic color from the ID hash
// Priority 4: Generic graduation cap SVG icon
//
// Uses inline styles for dynamic values (size, color) to avoid a CSS file.
// The component never causes layout shift — every state renders the same
// bounding box.


import React, { useState } from "react";


// ── Main component ────────────────────────────────────────────────────────────

export default function InstitutionLogo({
  institution,
  size      = 32,
  className = "",
}) {
  // Determine the starting phase synchronously to avoid a flash
  const startPhase = resolveStartPhase(institution);
  const [phase, setPhase] = useState(startPhase);

  // Uploaded URL read once at mount
  const [uploadedUrl] = useState(() => readUploadedUrl(institution));

  if (!institution) {
    return <FallbackLogo size={size} className={className} />;
  }

  if (phase === "uploaded" && uploadedUrl) {
    return (
      <img
        src={uploadedUrl}
        alt={institution.shortName || institution.id}
        width={size}
        height={size}
        className={className}
        style={imgStyle(size)}
        onError={() => setPhase(institution.logoUrl ? "url" : "initials")}
        loading="lazy"
      />
    );
  }

  if (phase === "url" && institution.logoUrl) {
    return (
      <img
        src={institution.logoUrl}
        alt={institution.shortName || institution.id}
        width={size}
        height={size}
        className={className}
        style={{ ...imgStyle(size), objectFit: "contain", padding: 2 }}
        onError={() => setPhase("initials")}
        loading="lazy"
      />
    );
  }

  if (phase === "initials") {
    return (
      <InitialsLogo
        institution={institution}
        size={size}
        className={className}
      />
    );
  }

  return <FallbackLogo size={size} className={className} />;
}


// ── Initials logo ─────────────────────────────────────────────────────────────

function InitialsLogo({ institution, size, className }) {
  const initials  = getInitials(institution);
  const bgColor   = getInstitutionColor(institution.id);
  const fontSize  = Math.round(size * 0.38);
  const radius    = Math.max(4, Math.round(size * 0.18));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label={institution.name}
      role="img"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect
        x="0" y="0"
        width={size}
        height={size}
        rx={radius}
        fill={bgColor}
      />
      <text
        x="50%"
        y="51%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="rgba(255,255,255,0.95)"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        letterSpacing="-0.01em"
      >
        {initials}
      </text>
    </svg>
  );
}


// ── Fallback graduation cap ───────────────────────────────────────────────────

function FallbackLogo({ size, className }) {
  const radius = Math.max(4, Math.round(size * 0.18));

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect
        x="0" y="0"
        width="32" height="32"
        rx={radius}
        fill="var(--color-surface-3)"
      />
      {/* Mortarboard */}
      <path
        d="M5 19.5 L16 12 L27 19.5"
        stroke="var(--color-text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect
        x="10.5" y="19.5" width="11" height="7" rx="1.5"
        fill="var(--color-text-muted)"
        opacity="0.45"
      />
      <rect
        x="14.5" y="10" width="3" height="3" rx="1.5"
        fill="var(--color-text-muted)"
        opacity="0.6"
      />
      <circle cx="16" cy="9" r="1.8"
        fill="var(--color-text-muted)"
        opacity="0.5"
      />
    </svg>
  );
}


// ── Phase resolution ──────────────────────────────────────────────────────────

function resolveStartPhase(institution) {
  if (!institution) return "fallback";

  try {
    const stored = localStorage.getItem(`ngcgpa_logo_${institution.id}`);
    if (stored) return "uploaded";
  } catch {
    // localStorage unavailable — skip to next
  }

  if (institution.logoUrl) return "url";
  return "initials";
}

function readUploadedUrl(institution) {
  if (!institution) return null;
  try {
    return localStorage.getItem(`ngcgpa_logo_${institution.id}`) || null;
  } catch {
    return null;
  }
}


// ── Initials extraction ───────────────────────────────────────────────────────

function getInitials(institution) {
  const source = institution.shortName || institution.id || "?";

  // Short codes (≤ 6 chars): take first two characters
  if (source.length <= 6) {
    return source.slice(0, 2).toUpperCase();
  }

  // Longer names: initials of first two words
  const words = source.trim().split(/[\s\-_]+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}


// ── Deterministic color from institution ID ───────────────────────────────────
// Uses a DJB2 hash to map institution IDs to a fixed palette of
// professional dark colors that contrast well with white text.

const COLOR_PALETTE = [
  "#1B4332", // Deep green (primary brand)
  "#1B3A5C", // Deep navy
  "#4A1942", // Deep plum
  "#5C1A1A", // Deep burgundy
  "#2D4A1E", // Forest green
  "#1A3A4A", // Deep teal
  "#3D2B1F", // Deep brown
  "#1F2D5C", // Midnight blue
  "#3A1A4A", // Deep violet
  "#1A4A3A", // Deep emerald
  "#4A2D1A", // Burnt sienna
  "#2B3A1A", // Olive
  "#1A2B4A", // Indigo
  "#4A1A2D", // Deep rose
  "#2D3A4A", // Slate
  "#1A4A1A", // Pure forest
];

function getInstitutionColor(id) {
  if (!id) return COLOR_PALETTE[0];

  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    // DJB2 hash
    hash = ((hash << 5) + hash) ^ id.charCodeAt(i);
    hash = hash & hash; // Force 32-bit int
  }

  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}


// ── Style helper ──────────────────────────────────────────────────────────────

function imgStyle(size) {
  return {
    display:      "block",
    width:        size,
    height:       size,
    borderRadius: Math.max(4, Math.round(size * 0.18)),
    objectFit:    "cover",
    flexShrink:   0,
    background:   "var(--color-surface-3)",
  };
}