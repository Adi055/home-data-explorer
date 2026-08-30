// Plain counter, not crypto.randomUUID(): ids just need to be unique
// within a session, and a counter is deterministic and trivial to reason
// about in tests.
let counter = 0;

export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
