const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** 1234 → "1.2K" */
export const formatCount = (value: number) => compact.format(value);
