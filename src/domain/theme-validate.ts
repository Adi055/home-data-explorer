import { DEFAULT_THEME } from "../data/theme-config";
import type { TenantTheme } from "../data/theme-config";

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isValidRadius(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 24;
}

function isValidAppName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Tenant configs come from customers and cannot be trusted (FR-8): every
// field is validated independently and falls back to DEFAULT_THEME on its
// own, so one bad field never drags the rest of an otherwise-valid config
// down with it.
export function resolveTheme(partial: Partial<TenantTheme> | undefined): TenantTheme {
  const p = partial ?? {};
  return {
    appName: isValidAppName(p.appName) ? p.appName : DEFAULT_THEME.appName,
    primary: isValidHex(p.primary) ? p.primary : DEFAULT_THEME.primary,
    onPrimary: isValidHex(p.onPrimary) ? p.onPrimary : DEFAULT_THEME.onPrimary,
    background: isValidHex(p.background) ? p.background : DEFAULT_THEME.background,
    surface: isValidHex(p.surface) ? p.surface : DEFAULT_THEME.surface,
    text: isValidHex(p.text) ? p.text : DEFAULT_THEME.text,
    radius: isValidRadius(p.radius) ? p.radius : DEFAULT_THEME.radius,
  };
}
