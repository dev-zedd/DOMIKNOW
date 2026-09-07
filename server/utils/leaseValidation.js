function validateLeaseTerms(body) {
    const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!date(body.lease_start_date) || !date(body.lease_end_date) || body.lease_end_date <= body.lease_start_date) {
        return 'Enter valid lease dates with the end date after the start date.';
    }
    for (const key of ['monthly_rent', 'security_deposit', 'advance_payment']) {
        const value = body[key];
        const amount = Number(value);
        if (!['string', 'number'].includes(typeof value) || !/^\d+(?:\.\d{1,2})?$/.test(String(value).trim())
            || !Number.isSafeInteger(Math.round(amount * 100)) || amount < 0 || (key === 'monthly_rent' && amount === 0)) {
            return 'Rent must be positive, deposits and advance payments nonnegative, with at most two decimal places.';
        }
    }
    const integer = (value, minimum, maximum = Number.MAX_SAFE_INTEGER) =>
        ['string', 'number'].includes(typeof value) && /^\d+$/.test(String(value))
        && Number.isSafeInteger(Number(value)) && Number(value) >= minimum && Number(value) <= maximum;
    if (!integer(body.payment_due_day, 1, 28)) return 'Payment due day must be a whole number between 1 and 28.';
    if (body.max_occupants != null && body.max_occupants !== '' && !integer(body.max_occupants, 1)) return 'Maximum occupants must be a positive whole number.';
    if (body.grace_period != null && body.grace_period !== '' && !integer(body.grace_period, 0)) return 'Grace period must be a nonnegative whole number.';
    return null;
}
module.exports = { validateLeaseTerms };
