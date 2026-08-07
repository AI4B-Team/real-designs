-- ============ Reference data ============
CREATE TABLE public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cbsa_code text,
  labor_factor numeric(5,3) NOT NULL DEFAULT 1.0,
  material_factor numeric(5,3) NOT NULL DEFAULT 1.0,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.markets TO anon, authenticated;
GRANT ALL ON public.markets TO service_role;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "markets_read" ON public.markets FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.unit_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  csi_division text NOT NULL,
  item_code text NOT NULL,
  description text NOT NULL,
  uom text NOT NULL,
  grade text NOT NULL DEFAULT 'retail',
  material_low numeric(10,2),
  material_high numeric(10,2),
  labor_low numeric(10,2),
  labor_high numeric(10,2),
  source text NOT NULL,
  source_ref text,
  n_samples int,
  effective_on date NOT NULL DEFAULT current_date,
  UNIQUE (item_code, grade, source, effective_on)
);
CREATE INDEX unit_costs_div_grade_idx ON public.unit_costs (csi_division, grade);
GRANT SELECT ON public.unit_costs TO anon, authenticated;
GRANT ALL ON public.unit_costs TO service_role;
ALTER TABLE public.unit_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unit_costs_read" ON public.unit_costs FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.cost_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  material text,
  grade text NOT NULL,
  unit_cost_id uuid NOT NULL REFERENCES public.unit_costs(id) ON DELETE CASCADE,
  qty_formula text NOT NULL,
  UNIQUE (label, material, grade)
);
GRANT SELECT ON public.cost_mappings TO anon, authenticated;
GRANT ALL ON public.cost_mappings TO service_role;
ALTER TABLE public.cost_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_mappings_read" ON public.cost_mappings FOR SELECT TO anon, authenticated USING (true);

-- ============ Property hierarchy ============
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  city text,
  state char(2),
  postal_code text,
  market_id uuid REFERENCES public.markets(id),
  design_dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX properties_owner_idx ON public.properties (owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "properties_own" ON public.properties FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  finish_grade text NOT NULL DEFAULT 'retail',
  budget_band text NOT NULL DEFAULT 'makeover',
  budget_target numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_property_idx ON public.projects (property_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_own" ON public.projects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  room_type text NOT NULL,
  floor_area_sf numeric(8,2),
  wall_area_sf numeric(8,2),
  ceiling_ht_in numeric(5,2),
  perimeter_lf numeric(8,2),
  dims_source text,
  dims_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rooms_project_idx ON public.rooms (project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_own" ON public.rooms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects pr JOIN public.properties p ON p.id = pr.property_id WHERE pr.id = project_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects pr JOIN public.properties p ON p.id = pr.property_id WHERE pr.id = project_id AND p.owner_id = auth.uid()));

CREATE TABLE public.versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  style text,
  before_path text NOT NULL,
  after_path text,
  gen_model text,
  gen_params jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, version_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.versions TO authenticated;
GRANT ALL ON public.versions TO service_role;
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions_own" ON public.versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rooms r JOIN public.projects pr ON pr.id = r.project_id JOIN public.properties p ON p.id = pr.property_id WHERE r.id = room_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms r JOIN public.projects pr ON pr.id = r.project_id JOIN public.properties p ON p.id = pr.property_id WHERE r.id = room_id AND p.owner_id = auth.uid()));

CREATE TABLE public.change_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.versions(id) ON DELETE CASCADE,
  action text NOT NULL,
  label text NOT NULL,
  material text,
  grade text,
  qty numeric(10,2),
  uom text,
  qty_source text,
  csi_division text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX change_items_version_idx ON public.change_items (version_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_items TO authenticated;
GRANT ALL ON public.change_items TO service_role;
ALTER TABLE public.change_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_items_own" ON public.change_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.versions v JOIN public.rooms r ON r.id = v.room_id JOIN public.projects pr ON pr.id = r.project_id JOIN public.properties p ON p.id = pr.property_id WHERE v.id = version_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.versions v JOIN public.rooms r ON r.id = v.room_id JOIN public.projects pr ON pr.id = r.project_id JOIN public.properties p ON p.id = pr.property_id WHERE v.id = version_id AND p.owner_id = auth.uid()));

CREATE TABLE public.scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.versions(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id),
  total_low numeric(12,2) NOT NULL,
  total_high numeric(12,2) NOT NULL,
  contingency_pct numeric(5,2) NOT NULL DEFAULT 10.0,
  layout_conf text NOT NULL,
  pricing_conf text NOT NULL,
  matched_pct numeric(5,2),
  budget_fit text,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scopes_version_idx ON public.scopes (version_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scopes TO authenticated;
GRANT ALL ON public.scopes TO service_role;
ALTER TABLE public.scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scopes_own" ON public.scopes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.versions v JOIN public.rooms r ON r.id = v.room_id JOIN public.projects pr ON pr.id = r.project_id JOIN public.properties p ON p.id = pr.property_id WHERE v.id = version_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.versions v JOIN public.rooms r ON r.id = v.room_id JOIN public.projects pr ON pr.id = r.project_id JOIN public.properties p ON p.id = pr.property_id WHERE v.id = version_id AND p.owner_id = auth.uid()));

CREATE TABLE public.scope_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES public.scopes(id) ON DELETE CASCADE,
  change_item_id uuid REFERENCES public.change_items(id) ON DELETE SET NULL,
  csi_division text,
  description text NOT NULL,
  trade text,
  qty numeric(10,2) NOT NULL,
  uom text NOT NULL,
  material_low numeric(12,2),
  material_high numeric(12,2),
  labor_low numeric(12,2),
  labor_high numeric(12,2),
  line_low numeric(12,2) NOT NULL,
  line_high numeric(12,2) NOT NULL,
  price_source text NOT NULL,
  is_fallback boolean NOT NULL DEFAULT false
);
CREATE INDEX scope_lines_scope_idx ON public.scope_lines (scope_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scope_lines TO authenticated;
GRANT ALL ON public.scope_lines TO service_role;
ALTER TABLE public.scope_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scope_lines_own" ON public.scope_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scopes s JOIN public.versions v ON v.id = s.version_id JOIN public.rooms r ON r.id = v.room_id JOIN public.projects pr ON pr.id = r.project_id JOIN public.properties p ON p.id = pr.property_id WHERE s.id = scope_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.scopes s JOIN public.versions v ON v.id = s.version_id JOIN public.rooms r ON r.id = v.room_id JOIN public.projects pr ON pr.id = r.project_id JOIN public.properties p ON p.id = pr.property_id WHERE s.id = scope_id AND p.owner_id = auth.uid()));