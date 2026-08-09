import { supabase } from "@/integrations/supabase/client";

export type FeedbackInput = {
  category: string;
  body: string;
  viewContext?: string | null;
  attachmentPath?: string | null;
};

/**
 * Stores in-app feedback for the signed-in user. RLS scopes every row to
 * its author, so the caller can never write or read someone else's feedback.
 */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const body = input.body.trim();
  if (body.length < 3) throw new Error("Please add a little more detail.");
  if (body.length > 5000) throw new Error("Feedback must be under 5000 characters.");

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to send feedback.");

  const { error } = await supabase.from("feedback").insert({
    user_id: uid,
    category: (input.category || "Something Else").slice(0, 60),
    body,
    view_context: input.viewContext ?? null,
    attachment_path: input.attachmentPath ?? null,
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
