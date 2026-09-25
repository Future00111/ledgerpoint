export const AUTOMATION_TEMPLATES = [
  {
    name: 'Invoice Reminders',
    description: 'Automatically remind customers when invoices become overdue.',
    category: 'sales',
    workflow: [
      { type: 'when', text: 'an invoice becomes overdue' },
      { type: 'wait', text: '7 days', config: { days: '7' } },
      { type: 'then', text: 'send email reminder' },
      { type: 'end' },
    ],
  },
  {
    name: 'Recurring Invoices',
    description: 'Create invoices automatically on a recurring monthly schedule.',
    category: 'sales',
    workflow: [
      { type: 'when', text: 'every month' },
      { type: 'then', text: 'create invoice' },
      { type: 'end' },
    ],
  },
  {
    name: 'Bill Approvals',
    description: 'Require approval for bills above a set amount.',
    category: 'purchases',
    workflow: [
      { type: 'when', text: 'a bill is received' },
      { type: 'if', text: 'amount is greater than 500', config: { condition: 'amount is greater than', value: '500' } },
      { type: 'then', text: 'request approval' },
      { type: 'end' },
    ],
  },
  {
    name: 'Supplier Approvals',
    description: 'Flag new suppliers for review before they are used.',
    category: 'purchases',
    workflow: [
      { type: 'when', text: 'a new supplier is added' },
      { type: 'then', text: 'flag for review' },
      { type: 'end' },
    ],
  },
  {
    name: 'Bank Reconciliation Rules',
    description: 'Automatically categorise bank transactions by description.',
    category: 'banking',
    workflow: [
      { type: 'when', text: 'a bank transaction needs review' },
      { type: 'if', text: 'description contains British Gas', config: { condition: 'description contains', value: 'British Gas' } },
      { type: 'then', text: 'categorise transaction' },
      { type: 'end' },
    ],
  },
  {
    name: 'VAT Reminders',
    description: 'Remind you when a VAT return is due soon.',
    category: 'vat',
    workflow: [
      { type: 'when', text: 'a VAT return is due' },
      { type: 'then', text: 'notify me' },
      { type: 'end' },
    ],
  },
  {
    name: 'Cash Flow Alerts',
    description: 'Alert when your bank balance drops below a threshold.',
    category: 'banking',
    workflow: [
      { type: 'when', text: 'every day' },
      { type: 'if', text: 'amount is less than 10000', config: { condition: 'amount is less than', value: '10000' } },
      { type: 'then', text: 'notify me' },
      { type: 'end' },
    ],
  },
  {
    name: 'Duplicate Invoice Detection',
    description: 'Flag potential duplicate invoices for review before posting.',
    category: 'ai',
    workflow: [
      { type: 'when', text: 'a document is uploaded' },
      { type: 'then', text: 'flag for review' },
      { type: 'end' },
    ],
  },
  {
    name: 'Monthly Management Reports',
    description: 'Generate and send a management report every month.',
    category: 'reports',
    workflow: [
      { type: 'when', text: 'every month' },
      { type: 'then', text: 'generate report' },
      { type: 'then', text: 'send email reminder' },
      { type: 'end' },
    ],
  },
];