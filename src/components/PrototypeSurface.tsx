import { useEffect, useRef } from "react";

type Props = {
  className: string;
  html: string;
  init: () => () => void;
};

/**
 * Mounts a ported prototype surface (markup + vanilla interactions) and
 * cleans up its timers on unmount.
 */
export function PrototypeSurface({ className, html, init }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cleanup = init();
    return cleanup;
  }, [init]);

  return (
    <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
