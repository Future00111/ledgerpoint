import { Link } from 'react-router-dom';
import { vatPath } from '@/features/reporting/model.mjs';

export const historicalStatus = status => ({ draft: 'Historical draft', ready_for_review: 'Historical review status', approved: 'Historical approval', submitted: 'Historical submitted status (unverified)' }[status] || 'Historical status unavailable');

export default function HistoricalVatNotice({ from, to }) {
  return <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <p className="font-semibold">Historical VAT record — figures may be incomplete</p>
    <p className="mt-1">This legacy record is separate from current posted VAT workings. Its status is not a verified HMRC submission receipt. Approval, recalculation and revision here do not submit a return.</p>
    <Link to={from && to ? vatPath(from, to) : '/vat'} className="mt-3 inline-block font-semibold underline">Review posted VAT for this period</Link>
  </div>;
}
