import { Customer, Order, Refund } from "@prisma/client";

export interface PolicyCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface EligibilityResult {
  eligible: boolean;
  decision: "APPROVED" | "DENIED" | "HUMAN_REVIEW";
  reasons: string[];
  checks: PolicyCheck[];
}

export interface EvaluateParams {
  customer: Customer | null;
  order: Order | null;
  previousRefunds: Refund[];
  requestedAmount?: number;
  customerId?: string;
  orderId?: string;
}

/**
 * Deterministic Refund Policy Engine
 * Evaluates request against strict business rules without LLM intervention.
 */
export function evaluateRefundEligibility(params: EvaluateParams): EligibilityResult {
  const { customer, order, previousRefunds, requestedAmount, customerId, orderId } = params;

  const checks: PolicyCheck[] = [];
  const reasons: string[] = [];

  // Check 1: Customer existence
  if (!customer) {
    checks.push({
      rule: "Customer Verification",
      passed: false,
      detail: `Customer '${customerId || "unknown"}' was not found in CRM.`,
    });
    reasons.push("Customer profile could not be verified in the database.");
    return { eligible: false, decision: "DENIED", reasons, checks };
  } else {
    checks.push({
      rule: "Customer Verification",
      passed: true,
      detail: `Customer verified: ${customer.name} (${customer.customerId}).`,
    });
  }

  // Check 2: Order existence
  if (!order) {
    checks.push({
      rule: "Order Verification",
      passed: false,
      detail: `Order '${orderId || "unknown"}' was not found in records.`,
    });
    reasons.push("Order could not be found in the database.");
    return { eligible: false, decision: "DENIED", reasons, checks };
  } else {
    checks.push({
      rule: "Order Verification",
      passed: true,
      detail: `Order verified: ${order.orderId} (${order.productName}).`,
    });
  }

  // Check 3: Order Ownership (Security Rule 8)
  const isOwner = order.customerId === customer.customerId;
  checks.push({
    rule: "Order Ownership",
    passed: isOwner,
    detail: isOwner
      ? `Order ${order.orderId} belongs to customer ${customer.customerId}.`
      : `Order ${order.orderId} belongs to customer ${order.customerId}, NOT ${customer.customerId}.`,
  });
  if (!isOwner) {
    reasons.push("Security Failure: The specified order does not belong to the identified customer.");
    return { eligible: false, decision: "DENIED", reasons, checks };
  }

  // Check 4: Fraud Flag (Rule 7)
  checks.push({
    rule: "Fraud Check",
    passed: !order.fraudFlag,
    detail: order.fraudFlag ? "Order is flagged for potential fraud." : "No fraud flags present.",
  });
  if (order.fraudFlag) {
    reasons.push("Order is flagged for security/fraud review and cannot be automatically refunded.");
    return { eligible: false, decision: "DENIED", reasons, checks };
  }

  // Check 5: Previous Approved Refunds (Rule 4)
  const existingApprovedRefund = previousRefunds.find(
    (r) => r.orderId === order.orderId && (r.status === "APPROVED" || r.status === "PROCESSING")
  );
  checks.push({
    rule: "Single Refund Policy",
    passed: !existingApprovedRefund,
    detail: existingApprovedRefund
      ? `An approved refund (${existingApprovedRefund.refundId}) already exists for this order.`
      : "No previous approved refunds found for this order.",
  });
  if (existingApprovedRefund) {
    reasons.push(`Order ${order.orderId} has already received a refund (${existingApprovedRefund.refundId}).`);
    return { eligible: false, decision: "DENIED", reasons, checks };
  }

  // Check 6: Multiple Failed Attempts / Suspicious History (Rule 12 -> HUMAN_REVIEW)
  const pastAttemptsCount = previousRefunds.filter((r) => r.orderId === order.orderId).length;
  if (pastAttemptsCount >= 2) {
    checks.push({
      rule: "Refund History Review",
      passed: false,
      detail: `Customer has ${pastAttemptsCount} previous refund attempts for this order.`,
    });
    reasons.push("Multiple prior refund attempts recorded. Requires manual human review.");
    return { eligible: false, decision: "HUMAN_REVIEW", reasons, checks };
  }

  // Check 7: Order Delivery Status (Rule 9)
  const isDelivered = order.status === "DELIVERED" && order.deliveryDate !== null;
  checks.push({
    rule: "Delivery Status",
    passed: isDelivered,
    detail: isDelivered
      ? `Order was delivered on ${new Date(order.deliveryDate!).toLocaleDateString()}.`
      : `Order status is '${order.status}' (delivery date: ${order.deliveryDate || "none"}).`,
  });
  if (!isDelivered) {
    reasons.push("Order has not been delivered yet. Standard refunds require confirmed delivery.");
    return { eligible: false, decision: "DENIED", reasons, checks };
  }

  // Check 8: Final Sale Status (Rule 3)
  checks.push({
    rule: "Final Sale Check",
    passed: !order.finalSale,
    detail: order.finalSale ? "Product is marked as Final Sale." : "Product is not Final Sale.",
  });
  if (order.finalSale) {
    reasons.push("Final-sale items are non-refundable per store policy.");
    return { eligible: false, decision: "DENIED", reasons, checks };
  }

  // Check 9: Clearance Status (Rule 3)
  checks.push({
    rule: "Clearance Check",
    passed: !order.clearance,
    detail: order.clearance ? "Product is marked as Clearance." : "Product is not Clearance.",
  });
  if (order.clearance) {
    reasons.push("Clearance items are non-refundable per store policy.");
    return { eligible: false, decision: "DENIED", reasons, checks };
  }

  // Check 10: Amount Validation (Rule 6)
  const effectiveAmount = requestedAmount ?? order.amount;
  const isAmountValid = effectiveAmount > 0 && effectiveAmount <= order.amount;
  checks.push({
    rule: "Refund Amount Validation",
    passed: isAmountValid,
    detail: `Requested $${effectiveAmount.toFixed(2)} vs Original Order Amount $${order.amount.toFixed(2)}.`,
  });
  if (!isAmountValid) {
    reasons.push(`Requested refund amount ($${effectiveAmount.toFixed(2)}) exceeds original order amount ($${order.amount.toFixed(2)}).`);
    return { eligible: false, decision: "DENIED", reasons, checks };
  }

  // Date calculations
  const deliveryTime = new Date(order.deliveryDate!).getTime();
  const nowTime = Date.now();
  const daysSinceDelivery = (nowTime - deliveryTime) / (1000 * 60 * 60 * 24);

  // Check 11 & 12: Product Condition & Refund Windows (Rules 1, 2, 5)
  if (order.condition === "DAMAGED") {
    // Damaged product policy: within 14 calendar days
    const isWithinDamagedWindow = daysSinceDelivery <= 14;
    checks.push({
      rule: "Damaged Item Policy (14 Days)",
      passed: isWithinDamagedWindow,
      detail: `Item is DAMAGED. Delivered ${daysSinceDelivery.toFixed(1)} days ago (Limit: 14 days).`,
    });
    if (!isWithinDamagedWindow) {
      reasons.push(`Damaged item refund requested ${daysSinceDelivery.toFixed(0)} days after delivery, which exceeds the 14-day limit.`);
      return { eligible: false, decision: "DENIED", reasons, checks };
    }
  } else if (order.condition === "UNUSED") {
    // Standard product policy: within 30 calendar days
    const isWithinStandardWindow = daysSinceDelivery <= 30;
    checks.push({
      rule: "Standard Refund Policy (30 Days)",
      passed: isWithinStandardWindow,
      detail: `Item is UNUSED. Delivered ${daysSinceDelivery.toFixed(1)} days ago (Limit: 30 days).`,
    });
    if (!isWithinStandardWindow) {
      reasons.push(`Standard refund requested ${daysSinceDelivery.toFixed(0)} days after delivery, which exceeds the 30-day limit.`);
      return { eligible: false, decision: "DENIED", reasons, checks };
    }
  } else {
    // Used condition
    checks.push({
      rule: "Product Condition Check",
      passed: false,
      detail: `Item condition is '${order.condition}'. Only UNUSED or DAMAGED items qualify.`,
    });
    reasons.push(`Item condition is '${order.condition}'. Standard refunds require unused, resalable condition.`);
    return { eligible: false, decision: "DENIED", reasons, checks };
  }

  // All checks passed!
  reasons.push("All policy requirements met successfully.");
  return {
    eligible: true,
    decision: "APPROVED",
    reasons,
    checks,
  };
}
