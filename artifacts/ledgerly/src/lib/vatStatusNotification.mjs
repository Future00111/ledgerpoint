/** A saved status is not a provider acknowledgement or proof of filing. */
export function vatStatusNotification(returns) {
  const recorded = (returns || []).find(row => row.status === 'submitted' || row.status === 'filed');
  if (!recorded) return null;
  return {
    title: `VAT return marked as ${recorded.status}`,
    desc: 'Status recorded in Ledgerly. Check the HMRC acknowledgement to confirm filing.',
    route: '/vat',
    date: recorded.created_date,
  };
}
