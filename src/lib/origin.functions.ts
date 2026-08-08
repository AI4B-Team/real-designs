import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** Absolute origin of the current request, used to build absolute og:image URLs. */
export const getRequestOrigin = createServerFn({ method: "GET" }).handler(() => {
  try {
    const req = getRequest();
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return host ? `${proto}://${host}` : "";
  } catch {
    return "";
  }
});
