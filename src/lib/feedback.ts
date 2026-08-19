import { supabase } from "@/integrations/supabase/client";

export type FeedbackInput = {
  category: string;
  body: string;
  viewContext?: string | null;
  attachmentPath?: string | null;
  /** Page the tester was on, e.g. "studio". */
  page?: string | null;
  /** Workflow in progress, e.g. "Photo Design". */
  workflow?: string | null;
  /** Safe diagnostic ID shown in the form, e.g. "RD-AB12-CD34". */
  diagnosticId?: string | null;
  /** The user's own wording before the AI polish pass, when one was used. */
  originalBody?: string | null;
  /** The AI-polished wording, when the user kept it. */
  polishedBody?: string | null;
  appVersion?: string | null;
  clientTimestamp?: string | null;
};

/**
 * Stores in-app feedback for the signed-in user. RLS scopes every row to
 * its author, so the caller can never write or read someone else's feedback.
 */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const body = input.body.trim();
  if (body.replace(/\s/g, "").length < 10)
    throw new Error("Please add at least 10 characters.");
  if (body.length > 5000) throw new Error("Feedback must be under 5000 characters.");

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to send feedback.");

  const { error } = await supabase.from("feedback").insert({
    user_id: uid,
    category: (input.category || "Other").slice(0, 60),
    body,
    view_context: input.viewContext ?? null,
    attachment_path: input.attachmentPath ?? null,
    page: (input.page ?? input.viewContext ?? null)?.slice(0, 80) ?? null,
    workflow: input.workflow?.slice(0, 80) ?? null,
    diagnostic_id: input.diagnosticId?.slice(0, 40) ?? null,
    original_body: input.originalBody ?? null,
    polished_body: input.polishedBody ?? null,
    app_version: input.appVersion?.slice(0, 80) ?? null,
    client_timestamp: input.clientTimestamp ?? null,
  });
  if (error) throw new Error(error.message);
}

export type FeedbackRow = {
  id: string;
  category: string;
  body: string;
  status: string;
  created_at: string;
};

export async function listMyFeedback(limit = 20): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("id,category,body,status,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as FeedbackRow[];
}
