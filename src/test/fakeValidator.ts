import type { Validator } from "../state/validatorContext";

interface FakeOutcome {
  result: "resolve" | "reject";
  delayMs: number;
  reason?: string;
}

// A controllable stand-in for mock-validator.ts's validateCalls, so tests
// can pick exact timing and outcomes instead of relying on the real
// validator's randomness. Outcomes are consumed in call order — not
// necessarily settlement order, since an earlier call can have a longer
// delay than one that starts after it (this is how the race/partial-
// failure test forces out-of-order settlement).
export function createFakeValidator(outcomes: FakeOutcome[]): Validator {
  let callIndex = 0;
  return () => {
    const outcome = outcomes[callIndex] ?? { result: "resolve" as const, delayMs: 10 };
    callIndex += 1;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (outcome.result === "resolve") resolve();
        else reject(outcome.reason ?? "rejected");
      }, outcome.delayMs);
    });
  };
}
