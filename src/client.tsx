import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// Keep the browser bootstrap in application source instead of serving the
// framework's default entry directly from node_modules. Preview proxies can
// invalidate that dependency URL while Vite is rebuilding, which leaves the
// page without React and produces a blank screen.
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
