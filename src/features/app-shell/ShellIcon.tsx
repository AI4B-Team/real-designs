import { DynamicIcon, type IconName } from "lucide-react/dynamic";

/**
 * Icons in the app shell render as React components, not as `<i data-lucide>`
 * placeholders swapped in later by the legacy bootstrap. A failure anywhere in
 * that bootstrap must never leave the sidebar, topbar or account menu blank.
 */
export function ShellIcon({ name, className }: { name: string; className?: string }) {
  return (
    <DynamicIcon name={name as IconName} className={className} size={16} aria-hidden="true" />
  );
}
