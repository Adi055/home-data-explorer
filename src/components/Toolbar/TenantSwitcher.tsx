import { useTheme } from "../../theme/ThemeProvider";

export function TenantSwitcher() {
  const { tenant, setTenant, tenantNames } = useTheme();

  return (
    <select className="tenant-select" value={tenant} onChange={(event) => setTenant(event.target.value)}>
      {tenantNames.map((name) => (
        <option key={name} value={name}>
          {name === "default" ? "Default" : name}
        </option>
      ))}
    </select>
  );
}
