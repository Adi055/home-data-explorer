import { createContext, useContext } from "react";
import { validateCalls } from "../data/mock-validator";

export type Validator = (newValue: number) => Promise<void>;

// Default is the real black-box validator; tests substitute a fake by
// wrapping the component tree in <ValidatorContext.Provider value={fake}>,
// which is what makes the async edit lifecycle deterministically testable
// without touching mock-validator.ts itself.
export const ValidatorContext = createContext<Validator>(validateCalls);

export function useValidator(): Validator {
  return useContext(ValidatorContext);
}
