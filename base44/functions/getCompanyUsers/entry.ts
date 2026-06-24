import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id } = await req.json();
    if (!company_id) return Response.json({ error: 'company_id is required' }, { status: 400 });

    // Verify user has access to this company
    const userLinks = await base44.asServiceRole.entities.CompanyUser.filter({
      company_id, user_id: user.id, status: 'active'
    });
    if (userLinks.length === 0) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all CompanyUser records for this company (excluding removed)
    const allLinks = await base44.asServiceRole.entities.CompanyUser.filter({
      company_id
    });
    const users = allLinks.filter(l => l.status !== 'removed');

    return Response.json({ users });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});