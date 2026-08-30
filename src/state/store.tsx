import { createContext, useContext, useReducer } from "react";
import type { Dispatch, ReactNode } from "react";
import { reducer } from "./reducer";
import { createInitialState } from "./types";
import type { AppState } from "./types";
import type { Action } from "./actions";

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(StateContext);
  if (!state) throw new Error("useAppState must be used inside <StoreProvider>");
  return state;
}

export function useAppDispatch(): Dispatch<Action> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error("useAppDispatch must be used inside <StoreProvider>");
  return dispatch;
}
