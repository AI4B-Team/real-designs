import { z } from "zod";

export const presentationTokenSchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{16,64}$/i),
});

export const presentationRespondSchema = presentationTokenSchema.extend({
  decision: z.enum(["approved", "changes"]),
  note: z.string().trim().max(1000).optional(),
});

export const presentationCreateSchema = z.object({
  version_id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  client_name: z.string().trim().max(120).optional(),
  client_email: z.string().trim().email().max(160).optional().or(z.literal("")),
});

export const presentationIdSchema = z.object({ id: z.string().uuid() });
