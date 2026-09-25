import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { link_id, updates } = await req.json();
    if (!link_id || !updates) {
      return Response.json({ error: 'link_id and updates are required' }, { status: 400 });
    }

    // Get the link to find the company
    const link = await base44.asServiceRole.entities.CompanyUser.get(link_id);

    // Verify current user is an owner of the company
    const ownerLinks = await base44.asServiceRole.entities.CompanyUser.filter({
      company_id: link.company_id, user_id: user.id, role: 'owner', status: 'active'
    });
    if (ownerLinks.length === 0) {
      return Response.json({ error: 'Only company owners can manage users' }, { status: 403 });
    }

    // Don't allow removing or downgrading the last owner
    if (updates.status === 'removed' && link.role === 'owner') {
      const owners = await base44.asServiceRole.entities.CompanyUser.filter({
        company_id: link.company_id, role: 'owner', status: 'active'
      });
      if (owners.length <= 1) {
        return Response.json({ error: 'Cannot remove the last owner' }, { status: 400 });
      }
    }
    if (updates.role && updates.role !== 'owner' && link.role === 'owner') {
      const owners = await base44.asServiceRole.entities.CompanyUser.filter({
        company_id: link.company_id, role: 'owner', status: 'active'
      });
      if (owners.length <= 1) {
        return Response.json({ error: 'Cannot change the last owner role' }, { status: 400 });
      }
    }

    await base44.asServiceRole.entities.CompanyUser.update(link_id, updates);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});