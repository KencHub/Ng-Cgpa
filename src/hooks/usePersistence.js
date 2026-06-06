// ── usePersistence.js ─────────────────────────────────────────────────────────
// Handles localStorage save and load for the application state.
//
// This hook is a side-effect layer only. It does not own any state.
// It receives the useCGPA return value, watches it for changes,
// and debounces writes to localStorage.
//
// On mount: loads saved state and calls the appropriate useCGPA actions.
// On change: debounces a save 800ms after the last state mutation.
//
// The rest of the app never accesses localStorage directly.


import { useEffect, useRef, useState, useCallback } from "react";
import {
  saveState,
  loadState,
  clearState,
  saveDismissed,
  loadDismissed,
  isStorageAvailable,
  getStorageUsage,
} from "../utils/storage.js";


// Debounce delay in ms. Long enough to batch rapid typing,
// short enough that the user does not lose data on sudden close.
const DEBOUNCE_MS = 800;

// localStorage threshold (bytes) at which we warn about storage pressure.
// 4 MB — well under the 5–10 MB typical limit.
const STORAGE_WARN_THRESHOLD = 4 * 1024 * 1024;


/**
 * Attaches persistence behaviour to the useCGPA hook.
 *
 * Usage in App.jsx:
 *   const cgpa = useCGPA();
 *   const { ready, storageAvailable } = usePersistence(cgpa);
 *
 * @param {Object} cgpa - Full return value from useCGPA()
 * @returns {{ ready: boolean, storageAvailable: boolean, storagePressure: boolean }}
 */
export function usePersistence(cgpa) {

  // ── Storage availability ────────────────────────────────────────────────────
  const [storageAvailable] = useState(() => isStorageAvailable());

  // ── Ready flag ──────────────────────────────────────────────────────────────
  // True after the initial load from localStorage completes.
  // Components that depend on loaded state should not render until ready.
  const [ready, setReady] = useState(false);

  // ── Storage pressure flag ───────────────────────────────────────────────────
  const [storagePressure, setStoragePressure] = useState(false);

  // ── Debounce timer ref ──────────────────────────────────────────────────────
  const saveTimer = useRef(null);

  // ── Refs to current state values ───────────────────────────────────────────
  // Using refs avoids stale closures in the debounced save callback.
  const stateRef = useRef({});

  // Update ref on every render with latest values
  stateRef.current = {
    institution:       cgpa.institution,
    useUILegacyScale:  cgpa.useUILegacyScale,
    student:           cgpa.student,
    semesters:         cgpa.semesters,
    projection:        cgpa.projection,
    activeTab:         cgpa.activeTab,
    dismissed:         cgpa.dismissed,
  };


  // ── Load on mount ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!storageAvailable) {
      setReady(true);
      return;
    }

    try {
      // Load main state
      const saved = loadState();
      if (saved) {
        cgpa.loadFromSaved(saved);
      }

      // Load dismissed suggestion IDs separately
      const savedDismissed = loadDismissed();
      if (savedDismissed && savedDismissed.size > 0) {
        cgpa.loadDismissedSet(savedDismissed);
      }
    } catch (err) {
      // Storage read failed — continue with default state
      console.warn("[NG CGPA] Load from storage failed:", err.message);
    } finally {
      setReady(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally empty — runs once on mount only.
  // cgpa.loadFromSaved is stable (useCallback with no deps that change).


  // ── Debounced save on state changes ────────────────────────────────────────
  // Watches the values that matter for persistence.
  // Does not save until `ready` is true to prevent overwriting
  // saved data with the default empty state before load completes.

  useEffect(() => {
    if (!ready || !storageAvailable) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      const s = stateRef.current;
      try {
        const saved = saveState({
          institution:      s.institution,
          useUILegacyScale: s.useUILegacyScale,
          student:          s.student,
          semesters:        s.semesters,
          projection:       s.projection,
          activeTab:        s.activeTab,
        });

        if (saved) {
          // Check storage pressure after each save
          const { usedBytes } = getStorageUsage();
          setStoragePressure(usedBytes > STORAGE_WARN_THRESHOLD);
        }
      } catch (err) {
        console.warn("[NG CGPA] Auto-save failed:", err.message);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    ready,
    storageAvailable,
    cgpa.institution,
    cgpa.useUILegacyScale,
    cgpa.student,
    cgpa.semesters,
    cgpa.projection,
    cgpa.activeTab,
  ]);


  // ── Save dismissed suggestions ──────────────────────────────────────────────
  // Dismissed is saved immediately (no debounce needed — it's small).

  useEffect(() => {
    if (!ready || !storageAvailable) return;
    try {
      saveDismissed(cgpa.dismissed);
    } catch {
      // Silent
    }
  }, [cgpa.dismissed, ready, storageAvailable]);


  // ── Clear persistence ────────────────────────────────────────────────────────
  // Called when the user confirms "Clear all data".
  // Wraps clearAllData from useCGPA with a localStorage wipe.

  const clearAndReset = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      clearState();
    } catch {
      // Silent
    }
    cgpa.clearAllData();
  }, [cgpa.clearAllData]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Flush save immediately ───────────────────────────────────────────────────
  // Called before PDF export or JSON export to ensure the save is current.

  const flushSave = useCallback(() => {
    if (!storageAvailable) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const s = stateRef.current;
    try {
      saveState({
        institution:      s.institution,
        useUILegacyScale: s.useUILegacyScale,
        student:          s.student,
        semesters:        s.semesters,
        projection:       s.projection,
        activeTab:        s.activeTab,
      });
    } catch {
      // Silent
    }
  }, [storageAvailable]);


  return {
    ready,
    storageAvailable,
    storagePressure,
    clearAndReset,
    flushSave,
  };
}