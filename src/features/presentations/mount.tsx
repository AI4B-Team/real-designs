import { createRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  PresentationList,
  type PresentationListDeps,
  type PresentationListHandle,
} from "./PresentationList";

/**
 * Mount adapter for the client-link list.
 *
 * The legacy runtime calls this once per app boot and then talks to the list
 * only through the returned handle. Unmounting tears down the React root, its
 * timers and its window listener, so a remount leaves nothing behind.
 */
export interface MountedPresentationList extends PresentationListHandle {
  destroy(): void;
}

export function mountPresentationList(
  container: HTMLElement,
  deps: PresentationListDeps,
): MountedPresentationList {
  container.innerHTML = "";
  const ref = createRef<PresentationListHandle>();
  const root: Root = createRoot(container);
  root.render(<PresentationList ref={ref} {...deps} />);

  let destroyed = false;
  return {
    refresh: async () => {
      await ref.current?.refresh();
    },
    focus: async (id: string) => {
      await ref.current?.focus(id);
    },
    rows: () => ref.current?.rows() || [],
    // The legacy runtime tears the shell down from inside a React commit, and a
    // synchronous unmount there races the in-flight render. Deferring by one
    // microtask lets the current render finish first.
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      queueMicrotask(() => {
        root.unmount();
        container.innerHTML = "";
      });
    },
  };
}
