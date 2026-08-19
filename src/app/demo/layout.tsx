"use client";

import type { ReactNode } from "react";
import { DemoFlowProvider } from "@/lib/demo-flow/context";
import { FlowStepper } from "@/components/demo-flow/flow-stepper";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoFlowProvider>
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">
            Demo Flow — Fabricated Data, No Live Backend
          </span>
          <FlowStepper />
        </div>
        {children}
      </div>
    </DemoFlowProvider>
  );
}
