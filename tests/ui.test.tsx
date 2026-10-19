// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import HomePage from "@/app/page";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function renderApp() {
  render(<HomePage />);
  // The provider hydrates from localStorage in an effect.
  await waitFor(() => expect(screen.getByText("FuncLab")).toBeDefined());
}

describe("core user workflows", () => {
  it("seeds the demo workspace and shows calculated results", async () => {
    await renderApp();

    const signature = screen.getByLabelText("Signature of function 1") as HTMLInputElement;
    expect(signature.value).toBe("f(x)");

    const expression = screen.getByLabelText("Expression of function 1") as HTMLInputElement;
    expect(expression.value).toBe("x^2 - 4");

    // Shared variable x = 2 in the demo workspace, so f(x) = 0.
    await waitFor(() => {
      const table = screen.getByText("Results comparison").closest("section");
      expect(within(table as HTMLElement).getAllByText("0").length).toBeGreaterThan(0);
    });
  });

  it("recalculates when the expression changes and detects new variables", async () => {
    await renderApp();

    const expression = screen.getByLabelText("Expression of function 1") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(expression, { target: { value: "a*b + 1" } });
    });

    await waitFor(() => {
      expect(screen.getAllByLabelText(/Value of a for/).length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText(/Value of b for/).length).toBeGreaterThan(0);
    });
  });

  it("shows a friendly error for an invalid expression without breaking others", async () => {
    await renderApp();

    const expression = screen.getByLabelText("Expression of function 1") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(expression, { target: { value: "x +" } });
    });

    await waitFor(() => {
      expect(screen.getByText(/has an error/i)).toBeDefined();
    });
    // The other demo functions still render their values.
    expect(screen.getByLabelText("Expression of function 2")).toBeDefined();
  });

  it("adds a new function from the quick add bar", async () => {
    await renderApp();

    const quickAdd = screen.getByText("g(x) = sin(x)");
    await act(async () => {
      fireEvent.click(quickAdd);
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Signature of function 6")).toBeDefined();
    });
  });

  it("navigates to the value table and renders rows", async () => {
    await renderApp();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Tables" })[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Value table")).toBeDefined();
      expect(screen.getByText(/rows · undefined cells are highlighted/)).toBeDefined();
    });
  });

  it("builds graph traces and renders the graph explorer controls", async () => {
    await renderApp();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Graph" })[0]);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Graph explorer").length).toBeGreaterThan(0);
    });

    const modeSelect = screen.getByLabelText("Graph mode") as HTMLSelectElement;
    expect(modeSelect.value).toBe("cartesian");

    const axisSelect = screen.getByLabelText(/Horizontal axis variable/) as HTMLSelectElement;
    expect(axisSelect.value).toBe("x");

    // Switching to a 3D surface re-samples a grid without throwing.
    await act(async () => {
      fireEvent.change(modeSelect, { target: { value: "surface" } });
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Graph mode") as HTMLSelectElement).value).toBe("surface");
      expect(screen.getByLabelText("Grid resolution")).toBeDefined();
    });
  });

  it("toggles the angle mode from the header", async () => {
    await renderApp();

    const toggle = screen.getByRole("button", { name: "RAD" });
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "DEG" })).toBeDefined());
  });
});
