export function calculatePaymentStatus(currentStatus, amountPaid, total, dueDate) {
  // Don't override draft or cancelled — those are manual states
  if (currentStatus === 'draft' || currentStatus === 'cancelled') {
    return currentStatus;
  }

  const today = new Date().toISOString().split('T')[0];
  const balanceDue = Math.max(0, total - amountPaid);

  // Paid: amount paid equals or exceeds total
  if (amountPaid >= total && total > 0) {
    return 'paid';
  }

  // Overdue: due date passed and still has balance
  if (dueDate && dueDate < today && balanceDue > 0) {
    return 'overdue';
  }

  // Part Paid: partial payment received
  if (amountPaid > 0 && amountPaid < total) {
    return 'part_paid';
  }

  // Keep current status (sent, awaiting_review, approved, etc.)
  return currentStatus;
}