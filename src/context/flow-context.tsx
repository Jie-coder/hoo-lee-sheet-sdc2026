// Shared client-side flow state: consent, profile, interview answers, chosen
// role. Lives only in sessionStorage (cleared when the tab closes), per the
// landing page's privacy promise. No backend, no login.
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PERSONAS, type PersonaId } from "@/mocks/personas";
import type { LanguageCode, ParsedCvEducation, ParsedCvRole, PartialSlots } from "@/types/contracts";

export type FlowSkill = {
  id: string;
  label: string;
  /** Cleared the ESCO match threshold (cosine >= 0.82). */
  matched: boolean;
  /** Added by the user after parsing, so it counts at half weight. */
  selfReported: boolean;
};

export type FlowProfile = {
  personaId: PersonaId | "upload";
  name: string;
  roles: ParsedCvRole[];
  education: ParsedCvEducation[];
  skills: FlowSkill[];
  courseLanguages: LanguageCode[];
};

type FlowState = {
  consent: boolean;
  consentAt: string | null;
  profile: FlowProfile | null;
  interviewAnswers: PartialSlots;
  chosenRoleId: string | null;
};

const EMPTY_STATE: FlowState = {
  consent: false,
  consentAt: null,
  profile: null,
  interviewAnswers: {},
  chosenRoleId: null,
};

const STORAGE_KEY = "laluan:flow:v1";

function slugify(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug}-${index}`;
}

function profileFromPersona(personaId: PersonaId): FlowProfile {
  const persona = PERSONAS[personaId];
  return {
    personaId,
    name: persona.parsed.name ?? persona.name,
    roles: persona.parsed.roles,
    education: persona.parsed.education,
    courseLanguages: persona.courseLanguages,
    skills: persona.parsed.skills.map((label, index) => ({
      id: slugify(label, index),
      label,
      matched: !persona.unmatchedSkills.includes(label),
      selfReported: false,
    })),
  };
}

function emptyUploadProfile(): FlowProfile {
  return {
    personaId: "upload",
    name: "",
    roles: [],
    education: [],
    courseLanguages: ["en"],
    skills: [],
  };
}

type FlowContextValue = FlowState & {
  /** True once sessionStorage has been read; guards redirects on first paint. */
  hydrated: boolean;
  setConsent: (consent: boolean) => void;
  selectPersona: (personaId: PersonaId) => void;
  startUploadProfile: () => void;
  updateProfile: (patch: Partial<Pick<FlowProfile, "name" | "roles" | "education">>) => void;
  addSkill: (label: string) => void;
  removeSkill: (id: string) => void;
  toggleCourseLanguage: (language: LanguageCode) => void;
  setCourseLanguages: (languages: LanguageCode[]) => void;
  setInterviewAnswers: (answers: PartialSlots) => void;
  setChosenRoleId: (occupationId: string | null) => void;
  resetFlow: () => void;
};

const FlowContext = createContext<FlowContextValue | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      // One-time hydration from sessionStorage: SSR has no window, so this
      // can only run after mount, and only once (empty deps).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...EMPTY_STATE, ...JSON.parse(raw) });
    } catch {
      // Corrupted or unavailable storage: start from the empty state.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing / quota: state stays in memory for this page only.
    }
  }, [state, hydrated]);

  const setConsent = useCallback((consent: boolean) => {
    setState((prev) => ({ ...prev, consent, consentAt: consent ? new Date().toISOString() : null }));
  }, []);

  const selectPersona = useCallback((personaId: PersonaId) => {
    setState((prev) => ({ ...prev, profile: profileFromPersona(personaId) }));
  }, []);

  const startUploadProfile = useCallback(() => {
    setState((prev) => ({ ...prev, profile: emptyUploadProfile() }));
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<Pick<FlowProfile, "name" | "roles" | "education">>) => {
      setState((prev) => (prev.profile ? { ...prev, profile: { ...prev.profile, ...patch } } : prev));
    },
    [],
  );

  const addSkill = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setState((prev) => {
      if (!prev.profile) return prev;
      if (prev.profile.skills.some((skill) => skill.label.toLowerCase() === trimmed.toLowerCase())) return prev;
      const skill: FlowSkill = {
        id: slugify(trimmed, prev.profile.skills.length),
        label: trimmed,
        matched: false,
        selfReported: true,
      };
      return { ...prev, profile: { ...prev.profile, skills: [...prev.profile.skills, skill] } };
    });
  }, []);

  const removeSkill = useCallback((id: string) => {
    setState((prev) =>
      prev.profile
        ? { ...prev, profile: { ...prev.profile, skills: prev.profile.skills.filter((skill) => skill.id !== id) } }
        : prev,
    );
  }, []);

  const toggleCourseLanguage = useCallback((language: LanguageCode) => {
    setState((prev) => {
      if (!prev.profile) return prev;
      const current = prev.profile.courseLanguages;
      const has = current.includes(language);
      if (has && current.length === 1) return prev; // at least one language stays selected
      const courseLanguages = has ? current.filter((item) => item !== language) : [...current, language];
      return { ...prev, profile: { ...prev.profile, courseLanguages } };
    });
  }, []);

  const setCourseLanguages = useCallback((languages: LanguageCode[]) => {
    if (languages.length === 0) return; // at least one language stays selected
    setState((prev) => (prev.profile ? { ...prev, profile: { ...prev.profile, courseLanguages: languages } } : prev));
  }, []);

  const setInterviewAnswers = useCallback((answers: PartialSlots) => {
    setState((prev) => ({ ...prev, interviewAnswers: answers }));
  }, []);

  const setChosenRoleId = useCallback((occupationId: string | null) => {
    setState((prev) => ({ ...prev, chosenRoleId: occupationId }));
  }, []);

  const resetFlow = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private browsing / quota: nothing to clear.
    }
    setState(EMPTY_STATE);
  }, []);

  const value = useMemo<FlowContextValue>(
    () => ({
      ...state,
      hydrated,
      setConsent,
      selectPersona,
      startUploadProfile,
      updateProfile,
      addSkill,
      removeSkill,
      toggleCourseLanguage,
      setCourseLanguages,
      setInterviewAnswers,
      setChosenRoleId,
      resetFlow,
    }),
    [
      state,
      hydrated,
      setConsent,
      selectPersona,
      startUploadProfile,
      updateProfile,
      addSkill,
      removeSkill,
      toggleCourseLanguage,
      setCourseLanguages,
      setInterviewAnswers,
      setChosenRoleId,
      resetFlow,
    ],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used within a FlowProvider");
  return ctx;
}
