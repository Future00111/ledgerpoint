import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id, email, role } = await req.json();
    if (!company_id || !email || !role) {
      return Response.json({ error: 'company_id, email, and role are required' }, { status: 400 });
    }

    // Verify current user is an owner of the company
    const ownerLinks = await base44.asServiceRole.entities.CompanyUser.filter({
      company_id, user_id: user.id, role: 'owner', status: 'active'
    });
    if (ownerLinks.length === 0) {
      return Response.json({ error: 'Only company owners can invite users' }, { status: 403 });
    }

    // Check if user is already linked or invited
    const existing = await base44.asServiceRole.entities.CompanyUser.filter({
      company_id, user_email: email.toLowerCase()
    });
    const activeExisting = existing.filter(l => l.status !== 'removed');
    if (activeExisting.length > 0) {
      return Response.json({ error: 'User already invited or linked to this company' }, { status: 400 });
    }

    // Invite user to the app
    try {
      await base44.users.inviteUser(email, 'user');
    } catch (e) {
      // User might already exist in the app - that's ok
    }

    // Create CompanyUser record
    const link = await base44.asServiceRole.entities.CompanyUser.create({
      company_id,
      user_email: email.toLowerCase(),
      role,
      status: 'invited',
      invited_by: user.id,
    });

    return Response.json({ success: true, link });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});