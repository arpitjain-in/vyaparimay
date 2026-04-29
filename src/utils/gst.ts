/** Return true if the two state names differ (case-insensitive) */
export function isInterState(businessState: string, customerState: string): boolean {
  return businessState.trim().toLowerCase() !== customerState.trim().toLowerCase();
}

/** Calculate CGST, SGST, IGST for a line item */
export function calcGST(
  taxableValue: number,
  gstRate: number,
  inter: boolean,
): { cgst: number; sgst: number; igst: number } {
  const total = taxableValue * (gstRate / 100);
  if (inter) return { cgst: 0, sgst: 0, igst: total };
  return { cgst: total / 2, sgst: total / 2, igst: 0 };
}
