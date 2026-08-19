"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DEFAULT_CRITERIA } from "@/lib/demo-flow/constants";
import type { CompletionMap, Criterion } from "@/lib/demo-flow/types";

interface DemoFlowState {
  criteria: Criterion[];
  setCriteria: (criteria: Criterion[]) => void;
  completion: CompletionMap;
  setCompletion: (completion: CompletionMap) => void;
  agreed: boolean;
  setAgreed: (agreed: boolean) => void;
  funded: boolean;
  setFunded: (funded: boolean) => void;
  reset: () => void;
}

const DemoFlowContext = createContext<DemoFlowState | null>(null);

export function DemoFlowProvider({ children }: { children: ReactNode }) {
  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA);
  const [completion, setCompletion] = useState<CompletionMap>({});
  const [agreed, setAgreed] = useState(false);
  const [funded, setFunded] = useState(false);

  function reset() {
    setCriteria(DEFAULT_CRITERIA);
    setCompletion({});
    setAgreed(false);
    setFunded(false);
  }

  return (
    <DemoFlowContext.Provider
      value={{ criteria, setCriteria, completion, setCompletion, agreed, setAgreed, funded, setFunded, reset }}
    >
      {children}
    </DemoFlowContext.Provider>
  );
}

export function useDemoFlow() {
  const ctx = useContext(DemoFlowContext);
  if (!ctx) throw new Error("useDemoFlow must be used within a DemoFlowProvider");
  return ctx;
}
