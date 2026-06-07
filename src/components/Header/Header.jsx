// ── Header.jsx ────────────────────────────────────────────────────────────────
// Added: onShareWhatsApp prop + WhatsApp share MenuItem.

import React, { useState, useRef, useEffect, useCallback } from "react";
import InstitutionSelector from "../InstitutionSelector/InstitutionSelector.jsx";
import "./Header.css";


export default function Header({
  institution,
  useUILegacyScale,
  onOpenSchoolModal,
  onOpenInfo,
  onOpenHelp,
  onOpenImport,
  onExportPDF,
  onExportJSON,
  onExportText,
  onDownloadText,
  onShareWhatsApp,
  onImportJSON,
  onClearData,
  hasData,
  storageAvailable,
}) {
  return (
    <header className="header" role="banner">
      <div className="header__inner">

        <BrandLogo />

        <div className="header__center">
          <InstitutionSelector
            institution={institution}
            useUILegacyScale={useUILegacyScale}
            onOpenModal={onOpenSchoolModal}
            onOpenInfo={onOpenInfo}
          />
        </div>

        <HeaderActions
          onOpenHelp={onOpenHelp}
          onOpenImport={onOpenImport}
          onExportPDF={onExportPDF}
          onExportJSON={onExportJSON}
          onExportText={onExportText}
          onDownloadText={onDownloadText}
          onShareWhatsApp={onShareWhatsApp}
          onImportJSON={onImportJSON}
          onClearData={onClearData}
          hasData={hasData}
        />

      </div>
    </header>
  );
}


// ── Brand logo ────────────────────────────────────────────────────────────────

function BrandLogo() {
  return (
    <div className="brand-logo" aria-label="NG CGPA home">
      <span className="brand-logo__icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="var(--color-primary)" />
          <path d="M5 18 L14 10 L23 18" stroke="var(--color-accent)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
          <rect x="9" y="18" width="10" height="6" rx="1.5" fill="var(--color-accent)" opacity="0.85" />
          <rect x="13" y="8" width="2" height="3" rx="1" fill="var(--color-accent-light)" />
        </svg>
      </span>
      <span className="brand-logo__wordmark">
        NG <strong>CGPA</strong>
      </span>
    </div>
  );
}


// ── Header actions ────────────────────────────────────────────────────────────

function HeaderActions({
  onOpenHelp,
  onOpenImport,
  onExportPDF,
  onExportJSON,
  onExportText,
  onDownloadText,
  onShareWhatsApp,
  onImportJSON,
  onClearData,
  hasData,
}) {
  return (
    <div className="header-actions">
      <button
        className="btn-icon header-actions__btn header-actions__import-btn"
        onClick={onOpenImport}
        title="Import courses"
        aria-label="Import courses"
      >
        <IconImport />
      </button>

      <button
        className="btn-icon header-actions__btn"
        onClick={onOpenHelp}
        title="Help centre"
        aria-label="Open help centre"
      >
        <IconHelp />
      </button>

      <DataMenu
        onOpenImport={onOpenImport}
        onExportPDF={onExportPDF}
        onExportJSON={onExportJSON}
        onExportText={onExportText}
        onDownloadText={onDownloadText}
        onShareWhatsApp={onShareWhatsApp}
        onImportJSON={onImportJSON}
        onClearData={onClearData}
        hasData={hasData}
      />
    </div>
  );
}


// ── Data menu ─────────────────────────────────────────────────────────────────

function DataMenu({
  onOpenImport,
  onExportPDF,
  onExportJSON,
  onExportText,
  onDownloadText,
  onShareWhatsApp,
  onImportJSON,
  onClearData,
  hasData,
}) {
  const [open, setOpen]   = useState(false);
  const containerRef      = useRef(null);
  const fileInputRef      = useRef(null);
  const firstItemRef      = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (open && firstItemRef.current) firstItemRef.current.focus();
  }, [open]);

  function toggle() { setOpen((o) => !o); }
  function close()  { setOpen(false); }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    onImportJSON(file);
    e.target.value = "";
    close();
  }

  return (
    <div className="data-menu" ref={containerRef}>

      <button
        className="btn btn-secondary data-menu__trigger"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Export and import options"
      >
        <IconDownload />
        <span className="data-menu__trigger-label">Export</span>
        <span className="data-menu__trigger-chevron" aria-hidden="true">
          <IconChevron open={open} />
        </span>
      </button>

      {open && (
        <div className="data-menu__panel" role="menu" aria-label="Data options">

          <div className="data-menu__section-label">Export</div>

          <MenuItem
            ref={firstItemRef}
            icon={<IconPDF />}
            label="Export PDF Report"
            description="Professional academic summary"
            onClick={() => { onExportPDF(); close(); }}
          />

          <MenuItem
            icon={<IconJSON />}
            label="Export JSON"
            description="Save full session data"
            onClick={() => { onExportJSON(); close(); }}
          />

          <MenuItem
            icon={<IconClipboard />}
            label="Copy Text Summary"
            description="For email or forms"
            onClick={() => { onExportText(); close(); }}
          />

          <MenuItem
            icon={<IconTextFile />}
            label="Download Text Summary"
            description="Save as .txt file"
            onClick={() => { onDownloadText(); close(); }}
          />

          <MenuItem
            icon={<IconWhatsApp />}
            label="Share to WhatsApp"
            description="Open WhatsApp with result pre-filled"
            onClick={() => { onShareWhatsApp(); close(); }}
          />

          <div className="data-menu__divider" role="separator" />
          <div className="data-menu__section-label">Import</div>

          <MenuItem
            icon={<IconImport />}
            label="Import Courses"
            description="Paste results as text or CSV"
            className="data-menu__item--import-courses"
            onClick={() => { onOpenImport(); close(); }}
          />

          <MenuItem
            icon={<IconUpload />}
            label="Import Session (JSON)"
            description="Restore a previous session"
            onClick={() => fileInputRef.current?.click()}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          {hasData && (
            <>
              <div className="data-menu__divider" role="separator" />
              <MenuItem
                icon={<IconTrash />}
                label="Clear All Data"
                description="Remove all semesters and courses"
                danger
                onClick={() => { onClearData(); close(); }}
              />
            </>
          )}

        </div>
      )}

    </div>
  );
}


// ── Menu item ─────────────────────────────────────────────────────────────────

const MenuItem = React.forwardRef(function MenuItem(
  { icon, label, description, onClick, danger },
  ref
) {
  return (
    <button
      ref={ref}
      className={`data-menu__item${danger ? " data-menu__item--danger" : ""}`}
      onClick={onClick}
      role="menuitem"
    >
      <span className="data-menu__item-icon" aria-hidden="true">{icon}</span>
      <span className="data-menu__item-text">
        <span className="data-menu__item-label">{label}</span>
        {description && (
          <span className="data-menu__item-desc">{description}</span>
        )}
      </span>
    </button>
  );
});


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconHelp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.2 6.2a1.8 1.8 0 0 1 3.5.6c0 1.2-1.7 1.8-1.7 3"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function IconImport() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2.5v7M5.5 7.5 8 10l2.5-2.5"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2.5v7M5.5 6.5 8 9.5l2.5-3"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPDF() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 5.5h4M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconJSON() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 5.5C3 5.5 2.5 6 2.5 7v2c0 1 .5 1.5 1.5 1.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12 5.5c1 0 1.5.5 1.5 1.5v2c0 1-.5 1.5-1.5 1.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6.5 10.5 8 5.5l1.5 5" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 3.5v-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 7.5h5M5.5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconTextFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="5" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="4.5" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="11.5" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.3 7.3l3.4-2M6.3 8.7l3.4 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9.5v-7M5.5 5 8 2.5 10.5 5"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.5h11M6 4.5V3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4.5l.7 8.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 7v4M9.5 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}