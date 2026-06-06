// ── useCGPA.js ────────────────────────────────────────────────────────────────
// Central state hook for the NG CGPA application.
//
// Owns all application state. Computes all derived values via useMemo.
// Every action is a useCallback — no component does raw state mutations.
//
// State is flat and minimal. Derived values (cgpa, degreeClass, suggestions,
// projectionResult) are computed fresh on every render from raw inputs.
// Nothing is stored redundantly.


import { useState, useMemo, useCallback, useEffect } from "react";

import { getInstitutionById } from "../data/institutionRegistry.js";
import {
  computeTotals,
  computeCGPA,
  getClassification,
  computeSemesterSummary,
  resolveCourse,
} from "../utils/calculator.js";
import { computeProjection }    from "../utils/projection.js";
import { computeSuggestions }   from "../utils/suggestions.js";
import {
  generateSemesterId,
  generateCourseId,
  generateSemesterLabel,
  ensureId,
} from "../utils/idGenerator.js";


// ── Default shapes ────────────────────────────────────────────────────────────

const BLANK_STUDENT = {
  name:            "",
  department:      "",
  faculty:         "",
  matricNumber:    "",
  level:           "",
  academicSession: "",
};

const BLANK_PROJECTION = {
  targetCGPA:             null,
  remainingSemesters:     null,
  estimatedCUPerSemester: null,
};

const BLANK_UI = {
  schoolModalOpen:  false,
  importModalOpen:  false,
  helpCenterOpen:   false,
  clearConfirmOpen: false,
};


// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCGPA() {

  // ── Raw state ───────────────────────────────────────────────────────────────
  const [institution,        setInstitutionState]  = useState(null);
  const [useUILegacyScale,   setUseUILegacyScale]  = useState(false);
  const [student,            setStudentState]       = useState(BLANK_STUDENT);
  const [semesters,          setSemesters]          = useState([]);
  const [activeTab,          setActiveTabState]     = useState(null);
  const [projection,         setProjectionState]    = useState(BLANK_PROJECTION);
  const [dismissed,          setDismissed]          = useState(new Set());
  const [ui,                 setUi]                 = useState(BLANK_UI);


  // ── Active grading context ──────────────────────────────────────────────────

  const activeGradeTable = useMemo(() => {
    if (useUILegacyScale && institution?.legacyScale) {
      return institution.legacyScale.gradeTable;
    }
    return institution?.gradeTable || [];
  }, [institution, useUILegacyScale]);

  const activeClassifications = useMemo(() => {
    if (useUILegacyScale && institution?.legacyScale) {
      return institution.legacyScale.classifications;
    }
    return institution?.classifications || [];
  }, [institution, useUILegacyScale]);

  const activeScale = useMemo(() => {
    if (useUILegacyScale && institution?.legacyScale) {
      return institution.legacyScale.scale;
    }
    return institution?.scale || 5.0;
  }, [institution, useUILegacyScale]);

  const activePassmark = useMemo(() => {
    if (useUILegacyScale && institution?.legacyScale) {
      return institution.legacyScale.passmark ?? institution.passmark ?? 40;
    }
    return institution?.passmark ?? 40;
  }, [institution, useUILegacyScale]);


  // ── Re-resolve all courses when grade table changes ─────────────────────────

  useEffect(() => {
    if (!activeGradeTable || activeGradeTable.length === 0) return;
    setSemesters((prev) =>
      prev.map((sem) => ({
        ...sem,
        courses: sem.courses.map((c) => resolveCourse(c, activeGradeTable)),
      }))
    );
  }, [activeGradeTable]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Derived: totals ─────────────────────────────────────────────────────────

  const totals = useMemo(
    () => computeTotals(semesters, activeGradeTable),
    [semesters, activeGradeTable]
  );


  // ── Derived: CGPA ───────────────────────────────────────────────────────────

  const cgpa = useMemo(() => {
    if (totals.totalCU === 0) return null;
    return Math.round((totals.totalQP / totals.totalCU) * 10000) / 10000;
  }, [totals]);


  // ── Derived: degree class ───────────────────────────────────────────────────

  const degreeClassEntry = useMemo(
    () => getClassification(cgpa, activeClassifications),
    [cgpa, activeClassifications]
  );

  const degreeClass      = degreeClassEntry?.label || null;
  const degreeClassShort = degreeClassEntry?.short || null;


  // ── Derived: per-semester summaries ────────────────────────────────────────

  const semesterSummaries = useMemo(
    () =>
      semesters.map((sem) => {
        const { totalCU, totalQP, gpa } = computeSemesterSummary(
          sem,
          activeGradeTable
        );
        return {
          semesterId: sem.id,
          label:      sem.label,
          totalCU,
          totalQP,
          gpa,
        };
      }),
    [semesters, activeGradeTable]
  );


  // ── Derived: active semester ────────────────────────────────────────────────

  const activeSemester = useMemo(
    () => semesters.find((s) => s.id === activeTab) || semesters[0] || null,
    [semesters, activeTab]
  );


  // ── Derived: projection result ──────────────────────────────────────────────

  const projectionResult = useMemo(() => {
    const { targetCGPA, remainingSemesters, estimatedCUPerSemester } = projection;

    if (
      targetCGPA === null ||
      remainingSemesters === null ||
      estimatedCUPerSemester === null
    ) {
      return null;
    }

    return computeProjection({
      targetCGPA,
      currentTotalCU:    totals.totalCU,
      currentTotalQP:    totals.totalQP,
      remainingSemesters,
      estimatedCUPerSem: estimatedCUPerSemester,
      scaleMax:          activeScale,
    });
  }, [projection, totals, activeScale]);


  // ── Derived: suggestions ────────────────────────────────────────────────────

  const suggestions = useMemo(() => {
    const effectiveInstitution = institution
      ? {
          ...institution,
          gradeTable:      activeGradeTable,
          classifications: activeClassifications,
          scale:           activeScale,
        }
      : null;

    return computeSuggestions({
      institution:    effectiveInstitution,
      semesters,
      cgpa,
      semesterGPAs:   semesterSummaries,
      dismissed,
    });
  }, [
    institution,
    activeGradeTable,
    activeClassifications,
    activeScale,
    semesters,
    cgpa,
    semesterSummaries,
    dismissed,
  ]);


  // ── Guard: keep activeTab valid ─────────────────────────────────────────────

  useEffect(() => {
    if (semesters.length === 0) {
      setActiveTabState(null);
      return;
    }
    const tabExists = semesters.some((s) => s.id === activeTab);
    if (!tabExists) {
      setActiveTabState(semesters[0].id);
    }
  }, [semesters, activeTab]);


  // ════════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  // ── Institution ─────────────────────────────────────────────────────────────

  const setInstitution = useCallback((inst) => {
    setInstitutionState(inst);
    setUseUILegacyScale(false);
  }, []);

  const toggleUILegacyScale = useCallback(() => {
    setUseUILegacyScale((prev) => !prev);
  }, []);


  // ── Student ─────────────────────────────────────────────────────────────────

  const updateStudent = useCallback((fields) => {
    setStudentState((prev) => ({ ...prev, ...fields }));
  }, []);


  // ── Semesters ───────────────────────────────────────────────────────────────

  const addSemester = useCallback(() => {
    const id = generateSemesterId();
    setSemesters((prev) => {
      const label = generateSemesterLabel(prev.length + 1);
      const sem   = { id, label, isCollapsed: false, courses: [] };
      setActiveTabState(id);
      return [...prev, sem];
    });
    return id;
  }, []);

  const removeSemester = useCallback((semesterId) => {
    setSemesters((prev) => {
      const idx      = prev.findIndex((s) => s.id === semesterId);
      const filtered = prev.filter((s) => s.id !== semesterId);

      setActiveTabState(() => {
        if (filtered.length === 0) return null;
        const targetIdx = Math.max(0, idx - 1);
        return filtered[targetIdx]?.id || filtered[0]?.id || null;
      });

      return filtered;
    });
  }, []);

  const renameSemester = useCallback((semesterId, newLabel) => {
    const trimmed = String(newLabel || "").trim().slice(0, 60);
    if (!trimmed) return;
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semesterId ? { ...s, label: trimmed } : s
      )
    );
  }, []);

  // setSemesterLabel is the public alias used by ImportModal after a file import.
  // It calls renameSemester so the same trimming and 60-char cap apply.
  const setSemesterLabel = renameSemester;

  const toggleSemesterCollapse = useCallback((semesterId) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semesterId ? { ...s, isCollapsed: !s.isCollapsed } : s
      )
    );
  }, []);

  const setActiveTab = useCallback((semesterId) => {
    setActiveTabState(semesterId);
  }, []);


  // ── Courses ─────────────────────────────────────────────────────────────────

  const addCourse = useCallback((semesterId) => {
    const id     = generateCourseId();
    const course = {
      id,
      name:         "",
      creditUnits:  "",
      score:        null,
      grade:        null,
      gradePoint:   null,
      qualityPoint: null,
      status:       "pending",
    };
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semesterId
          ? { ...s, courses: [...s.courses, course] }
          : s
      )
    );
    return id;
  }, []);

  const removeCourse = useCallback((semesterId, courseId) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semesterId
          ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) }
          : s
      )
    );
  }, []);

  const updateCourse = useCallback(
    (semesterId, courseId, changes) => {
      setSemesters((prev) =>
        prev.map((s) => {
          if (s.id !== semesterId) return s;
          return {
            ...s,
            courses: s.courses.map((c) => {
              if (c.id !== courseId) return c;
              const merged   = { ...c, ...changes };
              const resolved = resolveCourse(merged, activeGradeTable);
              return resolved;
            }),
          };
        })
      );
    },
    [activeGradeTable]
  );

  const importCoursesToSemester = useCallback(
    (semesterId, courses) => {
      const resolved = courses.map((c) => resolveCourse(c, activeGradeTable));
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === semesterId
            ? { ...s, courses: [...s.courses, ...resolved] }
            : s
        )
      );
    },
    [activeGradeTable]
  );

  const clearSemester = useCallback((semesterId) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semesterId ? { ...s, courses: [] } : s
      )
    );
  }, []);


  // ── Projection ───────────────────────────────────────────────────────────────

  const setProjection = useCallback((fields) => {
    setProjectionState((prev) => ({ ...prev, ...fields }));
  }, []);


  // ── Suggestions ──────────────────────────────────────────────────────────────

  const dismissSuggestion = useCallback((id) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  const loadDismissedSet = useCallback((set) => {
    setDismissed(set instanceof Set ? set : new Set(set));
  }, []);


  // ── Modal controls ───────────────────────────────────────────────────────────

  const openModal = useCallback((modalName) => {
    setUi((prev) => ({ ...prev, [modalName]: true }));
  }, []);

  const closeModal = useCallback((modalName) => {
    setUi((prev) => ({ ...prev, [modalName]: false }));
  }, []);


  // ── Clear all ────────────────────────────────────────────────────────────────

  const clearAllData = useCallback(() => {
    setInstitutionState(null);
    setUseUILegacyScale(false);
    setStudentState(BLANK_STUDENT);
    setSemesters([]);
    setActiveTabState(null);
    setProjectionState(BLANK_PROJECTION);
    setDismissed(new Set());
    setUi(BLANK_UI);
  }, []);


  // ── Load from saved ───────────────────────────────────────────────────────────

  const loadFromSaved = useCallback((saved) => {
    if (!saved) return;

    if (saved.institutionId) {
      let inst = getInstitutionById(saved.institutionId);

      if (!inst && saved.customInstitution) {
        inst = {
          ...saved.customInstitution,
          status: "active",
        };
      }

      if (inst) setInstitutionState(inst);
    }

    if (saved.useUILegacyScale) {
      setUseUILegacyScale(saved.useUILegacyScale);
    }

    if (saved.student) {
      setStudentState((prev) => ({ ...prev, ...saved.student }));
    }

    if (Array.isArray(saved.semesters) && saved.semesters.length > 0) {
      const restored = saved.semesters.map((sem) => ({
        ...sem,
        id:          ensureId(sem.id, "semester"),
        isCollapsed: false,
        courses:     (sem.courses || []).map((c) => ({
          ...c,
          id: ensureId(c.id, "course"),
        })),
      }));
      setSemesters(restored);

      const tabId =
        saved.activeTab && restored.find((s) => s.id === saved.activeTab)
          ? saved.activeTab
          : restored[0]?.id || null;
      setActiveTabState(tabId);
    }

    if (saved.projection) {
      setProjectionState((prev) => ({ ...prev, ...saved.projection }));
    }
  }, []);


  // ── Return ───────────────────────────────────────────────────────────────────

  return {
    // ── Raw state ──────────────────────────────────────────────────────────
    institution,
    useUILegacyScale,
    student,
    semesters,
    activeTab,
    projection,
    dismissed,
    ui,

    // ── Active grading context ─────────────────────────────────────────────
    activeGradeTable,
    activeClassifications,
    activeScale,
    activePassmark,

    // ── Derived values ─────────────────────────────────────────────────────
    cgpa,
    degreeClass,
    degreeClassShort,
    degreeClassEntry,
    totals,
    semesterSummaries,
    activeSemester,
    projectionResult,
    suggestions,

    // ── Actions ────────────────────────────────────────────────────────────
    setInstitution,
    toggleUILegacyScale,
    updateStudent,
    addSemester,
    removeSemester,
    renameSemester,
    setSemesterLabel,       // alias of renameSemester, used by ImportModal
    toggleSemesterCollapse,
    setActiveTab,
    addCourse,
    removeCourse,
    updateCourse,
    importCoursesToSemester,
    clearSemester,
    setProjection,
    dismissSuggestion,
    loadDismissedSet,
    openModal,
    closeModal,
    clearAllData,
    loadFromSaved,
  };
}