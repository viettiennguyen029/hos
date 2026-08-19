import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DemoFlowProvider, useDemoFlow } from "@/lib/demo-flow/context";

afterEach(() => cleanup());

function Consumer() {
  const { criteria, agreed, setAgreed, funded, setFunded, reset } = useDemoFlow();
  return (
    <div>
      <span data-testid="criteria-count">{criteria.length}</span>
      <span data-testid="agreed">{String(agreed)}</span>
      <span data-testid="funded">{String(funded)}</span>
      <button onClick={() => setAgreed(true)}>Agree</button>
      <button onClick={() => setFunded(true)}>Fund</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

describe("DemoFlowProvider", () => {
  it("starts with the default criteria and no agreement/funding", () => {
    render(
      <DemoFlowProvider>
        <Consumer />
      </DemoFlowProvider>
    );
    expect(screen.getByTestId("criteria-count").textContent).toBe("3");
    expect(screen.getByTestId("agreed").textContent).toBe("false");
    expect(screen.getByTestId("funded").textContent).toBe("false");
  });

  it("updates agreed/funded independently and resets both back to false", () => {
    render(
      <DemoFlowProvider>
        <Consumer />
      </DemoFlowProvider>
    );
    fireEvent.click(screen.getByText("Agree"));
    fireEvent.click(screen.getByText("Fund"));
    expect(screen.getByTestId("agreed").textContent).toBe("true");
    expect(screen.getByTestId("funded").textContent).toBe("true");

    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("agreed").textContent).toBe("false");
    expect(screen.getByTestId("funded").textContent).toBe("false");
  });

  it("throws when useDemoFlow is called outside the provider", () => {
    function Bare() {
      useDemoFlow();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/useDemoFlow must be used within a DemoFlowProvider/);
  });
});
