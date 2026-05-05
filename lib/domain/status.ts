export type PaymentStatus = "cleared" | "partial" | "pending" | "overdue";

export interface ComputeStatusInput {
  effectiveTarget: number;
  paid: number;
  installments: ReadonlyArray<{ expectedAmount: number; dueDate: string }>;
  today: string; // YYYY-MM-DD in Africa/Cairo
}

/**
 * Pure function — computes Payment Status from payments + installment due dates.
 * Precedence: Cleared > Overdue > Partial > Pending.
 *
 * Rules (per FR-014):
 *   - Cleared:  paid >= effectiveTarget
 *   - Overdue:  paid < ExpectedByNow  (where ExpectedByNow = sum of installment amounts whose due date is strictly before today)
 *   - Pending:  paid == 0 AND ExpectedByNow == 0  (no installment passed yet)
 *   - Partial:  anything in between
 */
export function computeStatus({
  effectiveTarget,
  paid,
  installments,
  today,
}: ComputeStatusInput): PaymentStatus {
  if (effectiveTarget === 0) {
    return paid > 0 ? "cleared" : "pending";
  }
  if (paid >= effectiveTarget) {
    return "cleared";
  }
  const expectedByNow = installments.reduce(
    (sum, inst) => (inst.dueDate < today ? sum + inst.expectedAmount : sum),
    0,
  );
  if (paid < expectedByNow) {
    return "overdue";
  }
  if (paid === 0) {
    return "pending";
  }
  return "partial";
}
