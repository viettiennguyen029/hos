export interface Criterion {
  id: string;
  label: string;
  weightPct: number;
}

export type CompletionMap = Record<string, boolean>;
