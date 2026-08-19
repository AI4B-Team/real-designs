import { z } from "zod";

export const pkgIdSchema = z.object({ id: z.string().uuid() });

export const pkgAssetSchema = z.object({
  section_key: z.string().trim().min(1).max(40),
  kind: z.string().trim().min(1).max(40),
  title: z.string().trim().max(160).nullable().optional(),
  caption: z.string().trim().max(400).nullable().optional(),
  url: z.string().trim().max(600).nullable().optional(),
  compare_url: z.string().trim().max(600).nullable().optional(),
  source_id: z.string().trim().max(120).nullable().optional(),
  meta: z.record(z.string(), z.any()).optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

export const pkgSectionSchema = z.object({
  section_key: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(80),
  hidden: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(99).optional(),
});

export const pkgSaveSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(120),
  property_id: z.string().uuid().nullable().optional(),
  property_label: z.string().trim().max(200).nullable().optional(),
  project_name: z.string().trim().max(120).nullable().optional(),
  client_name: z.string().trim().max(120).nullable().optional(),
  client_email: z.string().trim().max(160).nullable().optional(),
  intro: z.string().trim().max(2000).nullable().optional(),
  logo_url: z.string().trim().max(600).nullable().optional(),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  cover_url: z.string().trim().max(600).nullable().optional(),
  status: z.enum(["draft", "shared", "viewed", "approved", "changes"]).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  sections: z.array(pkgSectionSchema).max(20).optional(),
  assets: z.array(pkgAssetSchema).max(200).optional(),
});

export const pkgLinkSchema = z.object({
  package_id: z.string().uuid(),
  access_code: z.string().trim().max(40).nullable().optional(),
  expires_days: z.number().int().min(1).max(365).nullable().optional(),
});

export const pkgShareTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{16,64}$/i),
  code: z.string().trim().max(40).optional(),
});

export const pkgCommentSchema = pkgShareTokenSchema.extend({
  section: z.string().trim().max(40).optional(),
  name: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(1000),
});

export const pkgDecisionSchema = pkgShareTokenSchema.extend({
  decision: z.enum(["approved", "changes"]),
  name: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
});
