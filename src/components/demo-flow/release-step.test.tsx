import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const pushCalls: string[] = [];
mock.module("next/navigation", () => ({ useRouter: () => ({ push: (href: string) => pushCalls.push(href) }) }));

import { ReleaseStep } from "@/components/demo-flow/release-step";
import { DemoFlowProvider, useDemoFlow } from "@/lib/demo-flow/context";

afterEach(() => {
  cleanup();
  pushCalls.length = 0;
});

/** Seeds completion state (met: on-time + full-set, not: song-list) before rendering the release step. */
function Seeded() {
  const { setCompletion } = useDemoFlow();
  return (
    <>
      <button data-testid="seed" onClick={() => setCompletion({ "on-time": true, "full-set": true })} />
      <ReleaseStep />
    </>
  );
}

describe("ReleaseStep", () => {
  it("shows a full release with no refund when every criterion was met", () => {
    render(
      <DemoFlowProvider>
        <Seeded />
      </DemoFlowProvider>
    );
    fireEvent.click(screen.getByTestId("seed"));
    fireEvent.click(screen.getByTestId("seed"));

    expect(screen.getByText(/70% ·/i)).toBeInTheDocument();
    expect(screen.getByText("6,000,000 VND")).toBeInTheDocument();
    expect(screen.getByText(/refunded to organizer/i)).toBeInTheDocument();
  });

  it("resets the flow and navigates back to the chat step on restart", () => {
    render(
      <DemoFlowProvider>
        <ReleaseStep />
      </DemoFlowProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /restart demo/i }));
    expect(pushCalls).toEqual(["/demo"]);
  });
});
