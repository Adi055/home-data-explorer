import { describe, it, expect } from "vitest";
import { resolveTheme } from "../domain/theme-validate";
import { DEFAULT_THEME, TENANT_THEMES } from "../data/theme-config";

describe("resolveTheme", () => {
  it("returns DEFAULT_THEME untouched when given no config", () => {
    expect(resolveTheme(undefined)).toEqual(DEFAULT_THEME);
  });

  it("passes through a fully valid tenant config", () => {
    expect(resolveTheme(TENANT_THEMES.aurelia)).toEqual({
      appName: "Aurelia Field IQ",
      primary: "#0B5FA5",
      onPrimary: "#FFFFFF",
      background: "#FFFFFF",
      surface: "#EFF5FA",
      text: "#152A3E",
      radius: 8,
    });
  });

  it("falls back per-field for meridian's invalid hex, invalid radius, and missing fields", () => {
    const resolved = resolveTheme(TENANT_THEMES.meridian);
    expect(resolved.appName).toBe("Meridian 360"); // valid, passed through
    expect(resolved.primary).toBe(DEFAULT_THEME.primary); // invalid hex "#ZZ8800"
    expect(resolved.onPrimary).toBe(DEFAULT_THEME.onPrimary); // missing entirely
    expect(resolved.background).toBe("#FFFFFF"); // valid, passed through
    expect(resolved.surface).toBe("#F4F4F4"); // valid, passed through
    expect(resolved.text).toBe(DEFAULT_THEME.text); // missing entirely
    expect(resolved.radius).toBe(DEFAULT_THEME.radius); // invalid type (the string "huge")
  });

  it("never lets radius resolve to a non-numeric value", () => {
    const resolved = resolveTheme({ radius: "huge" as unknown as number });
    expect(typeof resolved.radius).toBe("number");
  });
});
