import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bank_account_id, company_id } = await req.json();
    if (!bank_account_id || !company_id) {
      return Response.json({ error: 'Missing bank_account_id or company_id' }, { status: 400 });
    }

    // Fetch the bank account
    const account = await base44.entities.BankAccount.get(bank_account_id);
    if (!account) {
      return Response.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // Fetch all transactions for this account
    const transactions = await base44.entities.BankTransaction.filter({
      bank_account_id,
      company_id
    }, 'date');

    // Calculate new balance
    let balance = account.opening_balance || 0;
    for (const txn of transactions) {
      if (txn.type === 'income') {
        balance += (txn.money_in || txn.amount || 0);
      } else if (txn.type === 'expense') {
        balance -= (txn.money_out || txn.amount || 0);
      } else if (txn.type === 'transfer') {
        balance += (txn.money_in || 0) - (txn.money_out || 0);
      }
    }

    // Update account balance
    await base44.entities.BankAccount.update(bank_account_id, {
      current_balance: balance
    });

    return Response.json({ balance });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});