CREATE OR REPLACE FUNCTION public.has_workspace_access(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.team_invites ti
        WHERE ti.owner_id = _owner
          AND ti.accepted_user_id = auth.uid()
          AND ti.status = 'accepted'
      );
$$;

REVOKE ALL ON FUNCTION public.has_workspace_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS properties_own ON public.properties;
CREATE POLICY properties_own ON public.properties FOR ALL TO authenticated
USING (public.has_workspace_access(owner_id))
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS projects_own ON public.projects;
CREATE POLICY projects_own ON public.projects FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = projects.property_id AND public.has_workspace_access(p.owner_id)))
WITH CHECK (EXISTS (SELECT 1 FROM properties p WHERE p.id = projects.property_id AND public.has_workspace_access(p.owner_id)));

DROP POLICY IF EXISTS rooms_own ON public.rooms;
CREATE POLICY rooms_own ON public.rooms FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM projects pr JOIN properties p ON p.id = pr.property_id WHERE pr.id = rooms.project_id AND public.has_workspace_access(p.owner_id)))
WITH CHECK (EXISTS (SELECT 1 FROM projects pr JOIN properties p ON p.id = pr.property_id WHERE pr.id = rooms.project_id AND public.has_workspace_access(p.owner_id)));

DROP POLICY IF EXISTS versions_own ON public.versions;
CREATE POLICY versions_own ON public.versions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM rooms r JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE r.id = versions.room_id AND public.has_workspace_access(p.owner_id)))
WITH CHECK (EXISTS (SELECT 1 FROM rooms r JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE r.id = versions.room_id AND public.has_workspace_access(p.owner_id)));

DROP POLICY IF EXISTS scopes_own ON public.scopes;
CREATE POLICY scopes_own ON public.scopes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM versions v JOIN rooms r ON r.id = v.room_id JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE v.id = scopes.version_id AND public.has_workspace_access(p.owner_id)))
WITH CHECK (EXISTS (SELECT 1 FROM versions v JOIN rooms r ON r.id = v.room_id JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE v.id = scopes.version_id AND public.has_workspace_access(p.owner_id)));

DROP POLICY IF EXISTS scope_lines_own ON public.scope_lines;
CREATE POLICY scope_lines_own ON public.scope_lines FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM scopes s JOIN versions v ON v.id = s.version_id JOIN rooms r ON r.id = v.room_id JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE s.id = scope_lines.scope_id AND public.has_workspace_access(p.owner_id)))
WITH CHECK (EXISTS (SELECT 1 FROM scopes s JOIN versions v ON v.id = s.version_id JOIN rooms r ON r.id = v.room_id JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE s.id = scope_lines.scope_id AND public.has_workspace_access(p.owner_id)));

DROP POLICY IF EXISTS change_items_own ON public.change_items;
CREATE POLICY change_items_own ON public.change_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM versions v JOIN rooms r ON r.id = v.room_id JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE v.id = change_items.version_id AND public.has_workspace_access(p.owner_id)))
WITH CHECK (EXISTS (SELECT 1 FROM versions v JOIN rooms r ON r.id = v.room_id JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE v.id = change_items.version_id AND public.has_workspace_access(p.owner_id)));

DROP POLICY IF EXISTS presentations_own ON public.presentations;
CREATE POLICY presentations_own ON public.presentations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM versions v JOIN rooms r ON r.id = v.room_id JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE v.id = presentations.version_id AND public.has_workspace_access(p.owner_id)))
WITH CHECK (EXISTS (SELECT 1 FROM versions v JOIN rooms r ON r.id = v.room_id JOIN projects pr ON pr.id = r.project_id JOIN properties p ON p.id = pr.property_id WHERE v.id = presentations.version_id AND public.has_workspace_access(p.owner_id)));