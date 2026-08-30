import "@testing-library/jest-dom/vitest";

// @tanstack/react-virtual needs real element dimensions to figure out which
// rows are "visible"; jsdom reports 0 for everything by default, which
// would make it render zero rows. Give every element a workable size.
Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
