// Compare money in integer centavos, counting only verified payments.
function getBillingBalance(totalAmount, payments = []) {
    const totalCents = Math.round(Number(totalAmount || 0) * 100);
    const paidCents = payments.filter(payment => payment.payment_status === 'verified')
        .reduce((sum, payment) => sum + Math.round(Number(payment.payment_amount || 0) * 100), 0);
    return {
        paid_amount: paidCents / 100,
        remaining_balance: Math.max(0, totalCents - paidCents) / 100
    };
}

function withBillingBalance(billing) {
    if (!billing) return null;
    const { payment_records = [], ...record } = billing;
    return { ...record, ...getBillingBalance(record.total_amount, payment_records) };
}

module.exports = { getBillingBalance, withBillingBalance };
