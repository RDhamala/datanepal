import { statusLabel } from "@/lib/data";

/**
 * Inline qualification for a figure: projection, estimate, provisional.
 *
 * Renders nothing when the value is an actual, so pages stay quiet in the
 * common case and speak up exactly when a reader would otherwise misread the
 * number. Presenting a projection as a census count is the specific error this
 * prevents.
 */
export function StatusNote({ status, period }: { status: string; period: number }) {
  const label = statusLabel(status);
  if (!label) return null;
  return (
    <span className="text-ink-faint text-[12px]">
      {period} {label}
    </span>
  );
}
