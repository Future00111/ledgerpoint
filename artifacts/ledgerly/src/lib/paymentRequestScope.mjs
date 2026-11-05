/** UI request lifetime only. The protected server remains the payment authority. */
export function createPaymentRequestScope(companyId) {
  let version = 0;
  return {
    invalidate() { version++; },
    begin() {
      const current = ++version;
      return { companyId, isCurrent: () => current === version };
    },
  };
}

/** Never let an old response overwrite a newer form, company or unmounted page. */
export async function runPaymentRequest(scope, request, { success, failure, finished }) {
  const ticket = scope.begin();
  try {
    const result = await request(ticket.companyId);
    if (ticket.isCurrent()) await success(result, ticket);
  } catch (error) {
    if (ticket.isCurrent()) failure(error);
  } finally {
    if (ticket.isCurrent()) finished();
  }
}

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export function bindPaymentReview(companyId, input, plan) {
  return freeze({ ...structuredClone(plan), company_id: companyId, input: structuredClone(input) });
}

export function paymentPostBody(companyId, review) {
  if (!review || review.company_id !== companyId || !review.review_token || !review.input) {
    throw new Error('Review this payment for the selected company before recording it.');
  }
  return { ...structuredClone(review.input), review_token: review.review_token };
}

export function paymentForEvent(payments, eventId) {
  return eventId ? payments?.find(payment => payment.events.some(event => event.id === eventId)) || null : null;
}
