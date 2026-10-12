import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Link invited records by email - update to active and set user_id
    const invitedLinks = await base44.asServiceRole.entities.CompanyUser.filter({
      user_email: user.email.toLowerCase(),
      status: 'invited'
    });
    for (const link of invitedLinks) {
      await base44.asServiceRole.entities.CompanyUser.update(link.id, {
        user_id: user.id,
        status: 'active'
      });
    }

    // Get all active links for the user
    const links = await base44.asServiceRole.entities.CompanyUser.filter({
      user_id: user.id,
      status: 'active'
    });

    // Get the companies
    const companies = [];
    const roles = {};
    for (const link of links) {
      try {
        const company = await base44.asServiceRole.entities.Company.get(link.company_id);
        companies.push(company);
        roles[company.id] = link.role;
      } catch (e) {
        // Company might have been deleted
      }
    }

    return Response.json({ companies, roles });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});