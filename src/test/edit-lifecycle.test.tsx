import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { ValidatorContext } from "../state/validatorContext";
import { createFakeValidator } from "./fakeValidator";

function renderApp(validator: ReturnType<typeof createFakeValidator>) {
  return render(
    <ValidatorContext.Provider value={validator}>
      <App />
    </ValidatorContext.Provider>,
  );
}

async function expandFirstTerritory(user: ReturnType<typeof userEvent.setup>) {
  const regionHeaders = await screen.findAllByTestId("region-header");
  await user.click(regionHeaders[0]);
  const territoryHeaders = await screen.findAllByTestId("territory-header");
  await user.click(territoryHeaders[0]);
  await screen.findAllByTestId("calls-cell");
}

// The Calls cell swaps between a <div> (view mode) and an <input> (edit
// mode) at the same position in the list, so a held element reference goes
// stale across that transition — every helper below re-queries by index
// instead of caching a node.
function getCell(index = 0): HTMLElement {
  return screen.getAllByTestId("calls-cell")[index];
}

function getTerritoryAgg(): string {
  return screen.getAllByTestId("agg-calls")[1].textContent ?? ""; // [0] = region, [1] = territory
}

async function commitEdit(user: ReturnType<typeof userEvent.setup>, index: number, value: string) {
  await user.click(getCell(index));
  const input = await screen.findByTestId("calls-input");
  await user.clear(input);
  await user.type(input, `${value}{Enter}`);
}

describe("edit lifecycle", () => {
  it("goes pending immediately, then saved, and only updates the aggregate after resolving", async () => {
    const user = userEvent.setup();
    const validator = createFakeValidator([{ result: "resolve", delayMs: 800 }]);
    renderApp(validator);
    await expandFirstTerritory(user);

    const aggBefore = getTerritoryAgg();
    await commitEdit(user, 0, "45");

    // Pending immediately, before the validator has had a chance to settle.
    expect(getCell(0)).toHaveAttribute("data-status", "pending");
    expect(getTerritoryAgg()).toBe(aggBefore);

    await waitFor(() => expect(getCell(0)).toHaveAttribute("data-status", "saved"), { timeout: 3000 });
    expect(getCell(0)).toHaveTextContent("45");
    expect(getTerritoryAgg()).not.toBe(aggBefore);
  });

  it("reverts and surfaces the reason on rejection (deterministic: value exceeds the call cap)", async () => {
    const user = userEvent.setup();
    const validator = createFakeValidator([{ result: "reject", delayMs: 500, reason: "exceeds per-HCP call cap (60)" }]);
    renderApp(validator);
    await expandFirstTerritory(user);

    const originalText = getCell(0).textContent;
    await commitEdit(user, 0, "70");

    await waitFor(() => expect(getCell(0)).toHaveAttribute("data-status", "rejected"), { timeout: 3000 });
    expect(getCell(0)).toHaveTextContent(originalText ?? "");
    expect(await screen.findByText(/exceeds per-HCP call cap/)).toBeInTheDocument();
  });

  it("locks the cell against re-editing while a commit is pending", async () => {
    const user = userEvent.setup();
    const validator = createFakeValidator([{ result: "resolve", delayMs: 600 }]);
    renderApp(validator);
    await expandFirstTerritory(user);

    await commitEdit(user, 0, "20");
    expect(getCell(0)).toHaveAttribute("data-status", "pending");

    await user.click(getCell(0)); // attempt to re-edit while pending
    expect(screen.queryByTestId("calls-input")).not.toBeInTheDocument();
    expect(getCell(0)).toHaveAttribute("data-status", "pending");

    await waitFor(() => expect(getCell(0)).toHaveAttribute("data-status", "saved"), { timeout: 3000 });
  });

  it("undoing a still-pending edit reverts immediately and discards the late validator response", async () => {
    const user = userEvent.setup();
    const validator = createFakeValidator([{ result: "resolve", delayMs: 600 }]);
    renderApp(validator);
    await expandFirstTerritory(user);

    const originalText = getCell(0).textContent;
    const aggBefore = getTerritoryAgg();

    await commitEdit(user, 0, "33");
    expect(getCell(0)).toHaveAttribute("data-status", "pending");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(getCell(0)).toHaveTextContent(originalText ?? "");

    // Wait past the fake validator's delay so the late response would
    // arrive, then confirm nothing changed as a result of it.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(getCell(0)).toHaveTextContent(originalText ?? "");
    expect(getCell(0)).not.toHaveAttribute("data-status", "saved");
    expect(getTerritoryAgg()).toBe(aggBefore);
  });

  it("undo then redo round-trips the value and the aggregate", async () => {
    const user = userEvent.setup();
    const validator = createFakeValidator([{ result: "resolve", delayMs: 500 }]);
    renderApp(validator);
    await expandFirstTerritory(user);

    const originalText = getCell(0).textContent;
    const aggBefore = getTerritoryAgg();

    await commitEdit(user, 0, "45");
    await waitFor(() => expect(getCell(0)).toHaveAttribute("data-status", "saved"), { timeout: 3000 });
    const aggAfter = getTerritoryAgg();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(getCell(0)).toHaveTextContent(originalText ?? "");
    expect(getTerritoryAgg()).toBe(aggBefore);

    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(getCell(0)).toHaveTextContent("45");
    expect(getTerritoryAgg()).toBe(aggAfter);
  });
});

describe("race / partial failure", () => {
  it("resolves two concurrent edits independently and correctly even when they settle out of order", async () => {
    const user = userEvent.setup();
    // Row A commits first but takes much longer; row B commits second but
    // is faster AND rejects — so B settles before A despite starting later.
    // A's delay is generous so it reliably outlasts the real time userEvent
    // spends driving both commits in this test environment.
    const validator = createFakeValidator([
      { result: "resolve", delayMs: 3000 }, // row A
      { result: "reject", delayMs: 800, reason: "validation service 503 (simulated)" }, // row B
    ]);
    renderApp(validator);
    await expandFirstTerritory(user);

    const originalB = getCell(1).textContent;

    await commitEdit(user, 0, "50");
    await commitEdit(user, 1, "51");

    expect(getCell(0)).toHaveAttribute("data-status", "pending");
    expect(getCell(1)).toHaveAttribute("data-status", "pending");

    // B settles first (rejected) while A is still pending.
    await waitFor(() => expect(getCell(1)).toHaveAttribute("data-status", "rejected"), { timeout: 5000 });
    expect(getCell(0)).toHaveAttribute("data-status", "pending");
    expect(getCell(1)).toHaveTextContent(originalB ?? "");

    // A settles afterward (saved), unaffected by B's rejection.
    await waitFor(() => expect(getCell(0)).toHaveAttribute("data-status", "saved"), { timeout: 8000 });
    expect(getCell(0)).toHaveTextContent("50");
    expect(getCell(1)).toHaveAttribute("data-status", "rejected");
  });
});
