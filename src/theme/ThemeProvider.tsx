import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { TENANT_THEMES } from "../data/theme-config";
import type { TenantTheme } from "../data/theme-config";
import { resolveTheme } from "../domain/theme-validate";

interface ThemeContextValue {
  tenant: string;
  setTenant: (tenant: string) => void;
  theme: TenantTheme;
  tenantNames: string[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialTenant(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("tenant") ?? "default";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState(initialTenant);

  // "default" isn't a real tenant config — resolveTheme(undefined) just
  // returns DEFAULT_THEME untouched. An unknown ?tenant= value falls back
  // the same way, since TENANT_THEMES[tenant] is then undefined too.
  const theme = useMemo(() => resolveTheme(TENANT_THEMES[tenant]), [tenant]);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--color-primary", theme.primary);
    root.setProperty("--color-on-primary", theme.onPrimary);
    root.setProperty("--color-background", theme.background);
    root.setProperty("--color-surface", theme.surface);
    root.setProperty("--color-text", theme.text);
    root.setProperty("--radius", `${theme.radius}px`);
    document.title = theme.appName;
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ tenant, setTenant, theme, tenantNames: ["default", ...Object.keys(TENANT_THEMES)] }),
    [tenant, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
