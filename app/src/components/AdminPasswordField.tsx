import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Admin password input for server-gated mutations (sites, farmers, landlords,
 * lots, bins, sync settings). Each dialog keeps its own state and remounts
 * when reopened, so the password is asked fresh every time.
 */
export function AdminPasswordField({
  id,
  value,
  onChange,
  hint = "This change requires the site admin password.",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Admin password</Label>
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
