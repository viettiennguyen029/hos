import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const toastCalls: { type: "error" | "success"; message: string }[] = [];
mock.module("sonner", () => ({
  toast: {
    error: (message: string) => toastCalls.push({ type: "error", message }),
    success: (message: string) => toastCalls.push({ type: "success", message }),
  },
}));
const refresh = mock(() => {});
mock.module("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

let updateResult: { error: string } | { success: true } = { success: true as const };
const updateCalls: [string, number][] = [];
mock.module("@/lib/supabase/admin-actions", () => ({
  updateTalentCommission: async (talentId: string, commissionBps: number) => {
    updateCalls.push([talentId, commissionBps]);
    return updateResult;
  },
}));

import { CommissionRow } from "@/components/admin/commission-row";

afterEach(() => {
  cleanup();
  toastCalls.length = 0;
  updateCalls.length = 0;
  updateResult = { success: true as const };
  refresh.mockClear();
});

describe("CommissionRow", () => {
  it("updates the commission and refreshes on success", async () => {
    render(<CommissionRow talentId="talent-1" fullName="Nova Events" initialCommissionBps={500} />);

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "750" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateCalls).toEqual([["talent-1", 750]]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Commission updated." });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an error toast without refreshing when the update fails", async () => {
    updateResult = { error: "Commission must be between 0 and 10000 basis points." };
    render(<CommissionRow talentId="talent-1" fullName="Nova Events" initialCommissionBps={500} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(toastCalls).toContainEqual({ type: "error", message: "Commission must be between 0 and 10000 basis points." });
    expect(refresh).not.toHaveBeenCalled();
  });
});
