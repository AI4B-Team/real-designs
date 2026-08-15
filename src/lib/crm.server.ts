/**
 * CRM provider adapters.
 *
 * Every adapter speaks plain HTTPS so it runs inside the edge worker. Nothing
 * here reads the database — the calling server function owns persistence and
 * only ever hands over one connection's credential.
 */

export type CrmProvider = "followupboss" | "hubspot" | "webhook";

export type CrmContact = {
  external_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string | null;
  tags: string[];
  last_activity_at: string | null;
};

export type CrmPush = {
  title: string;
  body: string;
  link?: string | null;
  contactExternalId?: string | null;
  contactEmail?: string | null;
};

export const CRM_LABELS: Record<CrmProvider, string> = {
  followupboss: "Follow Up Boss",
  hubspot: "HubSpot",
  webhook: "Custom Webhook",
};

function fail(provider: CrmProvider, status: number, body: string): never {
  const hint =
    status === 401 || status === 403
      ? "That key was rejected. Check the key and its permissions."
      : status === 429
        ? "The CRM is rate limiting requests. Try again in a minute."
        : body.slice(0, 180) || "The CRM returned an error.";
  throw new Error(`${CRM_LABELS[provider]}: ${hint}`);
}

async function req(provider: CrmProvider, url: string, init: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (_) {
    throw new Error(`${CRM_LABELS[provider]} could not be reached.`);
  }
  const text = await res.text();
  if (!res.ok) fail(provider, res.status, text);
  try {
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return {};
  }
}

function fubHeaders(key: string) {
  const basic = btoa(`${key}:`);
  return { Authorization: `Basic ${basic}`, "Content-Type": "application/json", Accept: "application/json" };
}

/** Confirms the credential works and returns the account name when available. */
export async function verifyCrm(
  provider: CrmProvider,
  credential: string,
  endpoint?: string | null,
): Promise<{ account: string | null }> {
  if (provider === "followupboss") {
    const out: any = await req(provider, "https://api.followupboss.com/v1/identity", { headers: fubHeaders(credential) });
    return { account: out?.account?.name || out?.name || null };
  }
  if (provider === "hubspot") {
    const out: any = await req(provider, "https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
    });
    return { account: Array.isArray(out?.results) ? "HubSpot Portal" : null };
  }
  const url = (endpoint || "").trim();
  if (!/^https:\/\//i.test(url)) throw new Error("Enter a full https webhook URL.");
  await req(provider, url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Real-Designs-Signature": credential },
    body: JSON.stringify({ type: "connection.test", source: "REAL DESIGNS", sent_at: new Date().toISOString() }),
  });
  return { account: new URL(url).hostname };
}

/** Pulls the most recent contacts so they can be attached to shared work. */
export async function fetchCrmContacts(
  provider: CrmProvider,
  credential: string,
  limit = 100,
): Promise<CrmContact[]> {
  if (provider === "followupboss") {
    const out: any = await req(
      provider,
      `https://api.followupboss.com/v1/people?limit=${Math.min(limit, 100)}&sort=-updated`,
      { headers: fubHeaders(credential) },
    );
    return (out?.people ?? []).map((p: any) => ({
      external_id: String(p.id),
      name: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || null,
      email: p.emails?.[0]?.value ?? null,
      phone: p.phones?.[0]?.value ?? null,
      stage: p.stage?.name ?? p.stage ?? null,
      tags: Array.isArray(p.tags) ? p.tags.map(String).slice(0, 12) : [],
      last_activity_at: p.updated ?? null,
    }));
  }
  if (provider === "hubspot") {
    const props = "firstname,lastname,email,phone,lifecyclestage,lastmodifieddate";
    const out: any = await req(
      provider,
      `https://api.hubapi.com/crm/v3/objects/contacts?limit=${Math.min(limit, 100)}&properties=${props}`,
      { headers: { Authorization: `Bearer ${credential}` } },
    );
    return (out?.results ?? []).map((c: any) => {
      const p = c.properties || {};
      return {
        external_id: String(c.id),
        name: [p.firstname, p.lastname].filter(Boolean).join(" ") || null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        stage: p.lifecyclestage ?? null,
        tags: [] as string[],
        last_activity_at: p.lastmodifieddate ?? null,
      };
    });
  }
  return [];
}

/** Sends one piece of REAL DESIGNS work back into the CRM timeline. */
export async function pushCrm(
  provider: CrmProvider,
  credential: string,
  payload: CrmPush,
  endpoint?: string | null,
): Promise<{ ok: true; detail: string }> {
  const text = [payload.title, payload.body, payload.link].filter(Boolean).join("\n");
  if (provider === "followupboss") {
    if (!payload.contactExternalId) throw new Error("Pick a CRM contact first.");
    await req(provider, "https://api.followupboss.com/v1/notes", {
      method: "POST",
      headers: fubHeaders(credential),
      body: JSON.stringify({ personId: Number(payload.contactExternalId), subject: payload.title.slice(0, 120), body: text }),
    });
    return { ok: true, detail: "Note added in Follow Up Boss." };
  }
  if (provider === "hubspot") {
    const note: any = await req(provider, "https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: { hs_note_body: text, hs_timestamp: new Date().toISOString() } }),
    });
    if (payload.contactExternalId && note?.id) {
      await req(
        provider,
        `https://api.hubapi.com/crm/v3/objects/notes/${note.id}/associations/contacts/${payload.contactExternalId}/note_to_contact`,
        { method: "PUT", headers: { Authorization: `Bearer ${credential}` } },
      );
    }
    return { ok: true, detail: "Note logged in HubSpot." };
  }
  const url = (endpoint || "").trim();
  if (!/^https:\/\//i.test(url)) throw new Error("This webhook has no https URL saved.");
  await req(provider, url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Real-Designs-Signature": credential },
    body: JSON.stringify({
      type: "content.shared",
      source: "REAL DESIGNS",
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      contact: { id: payload.contactExternalId ?? null, email: payload.contactEmail ?? null },
      sent_at: new Date().toISOString(),
    }),
  });
  return { ok: true, detail: "Delivered to your webhook." };
}
