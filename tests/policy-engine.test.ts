import { describe, it, expect } from "vitest";
import { evaluateRefundEligibility } from "@/lib/policy-engine";
import { executeProcessRefund } from "@/lib/agent/tools";
import { Customer, Order, Refund } from "@prisma/client";

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

const baseCustomer: Customer = {
  id: "c1",
  customerId: "CUST-001",
  name: "Alice Smith",
  email: "alice@example.com",
  phone: "555-0101",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseOrder: Order = {
  id: "o1",
  orderId: "ORD1001",
  customerId: "CUST-001",
  productName: "Headphones",
  productCategory: "Electronics",
  amount: 100.0,
  currency: "USD",
  purchaseDate: daysAgo(10),
  deliveryDate: daysAgo(5),
  status: "DELIVERED",
  condition: "UNUSED",
  finalSale: false,
  clearance: false,
  fraudFlag: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Deterministic Refund Policy Engine", () => {
  it("CUSTOMER 01: Standard eligible refund approved within 30 days", () => {
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: baseOrder,
      previousRefunds: [],
      requestedAmount: 100.0,
    });

    expect(res.eligible).toBe(true);
    expect(res.decision).toBe("APPROVED");
  });

  it("CUSTOMER 02: Refund window expired (> 30 days) denied", () => {
    const expiredOrder = { ...baseOrder, deliveryDate: daysAgo(45) };
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: expiredOrder,
      previousRefunds: [],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("exceeds the 30-day limit"))).toBe(true);
  });

  it("CUSTOMER 03: Final-sale product denied", () => {
    const finalSaleOrder = { ...baseOrder, finalSale: true };
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: finalSaleOrder,
      previousRefunds: [],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("Final-sale"))).toBe(true);
  });

  it("CUSTOMER 04: Order already refunded denied", () => {
    const existingRefund: Refund = {
      id: "r1",
      refundId: "REF1004",
      orderId: "ORD1001",
      customerId: "CUST-001",
      amount: 100.0,
      status: "APPROVED",
      reason: "Previous refund",
      createdAt: daysAgo(3),
      processedAt: daysAgo(3),
    };

    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: baseOrder,
      previousRefunds: [existingRefund],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("already received a refund"))).toBe(true);
  });

  it("CUSTOMER 05: Damaged product within 14 days approved", () => {
    const damagedOrder = { ...baseOrder, condition: "DAMAGED", deliveryDate: daysAgo(8) };
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: damagedOrder,
      previousRefunds: [],
    });

    expect(res.eligible).toBe(true);
    expect(res.decision).toBe("APPROVED");
  });

  it("CUSTOMER 06: Used product condition denied", () => {
    const usedOrder = { ...baseOrder, condition: "USED" };
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: usedOrder,
      previousRefunds: [],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("USED"))).toBe(true);
  });

  it("CUSTOMER 07: Security check - Order ownership mismatch denied", () => {
    const otherCustomer = { ...baseCustomer, customerId: "CUST-999" };
    const res = evaluateRefundEligibility({
      customer: otherCustomer,
      order: baseOrder,
      previousRefunds: [],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("Security Failure"))).toBe(true);
  });

  it("CUSTOMER 09: Fraud flagged order denied", () => {
    const fraudOrder = { ...baseOrder, fraudFlag: true };
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: fraudOrder,
      previousRefunds: [],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("fraud"))).toBe(true);
  });

  it("CUSTOMER 10: Requested amount exceeds original order amount denied", () => {
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: baseOrder,
      previousRefunds: [],
      requestedAmount: 250.0,
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("exceeds original order amount"))).toBe(true);
  });

  it("CUSTOMER 12: Clearance product denied", () => {
    const clearanceOrder = { ...baseOrder, clearance: true };
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: clearanceOrder,
      previousRefunds: [],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("Clearance"))).toBe(true);
  });

  it("CUSTOMER 13: Damaged product outside 14 days denied", () => {
    const oldDamagedOrder = { ...baseOrder, condition: "DAMAGED", deliveryDate: daysAgo(20) };
    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: oldDamagedOrder,
      previousRefunds: [],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("DENIED");
    expect(res.reasons.some((r) => r.includes("exceeds the 14-day limit"))).toBe(true);
  });

  it("CUSTOMER 14: Multiple past refund attempts triggers HUMAN_REVIEW", () => {
    const past1: Refund = { id: "r1", refundId: "R1", orderId: "ORD1001", customerId: "CUST-001", amount: 100, status: "DENIED", reason: "Attempt 1", createdAt: daysAgo(5), processedAt: null };
    const past2: Refund = { id: "r2", refundId: "R2", orderId: "ORD1001", customerId: "CUST-001", amount: 100, status: "DENIED", reason: "Attempt 2", createdAt: daysAgo(3), processedAt: null };

    const res = evaluateRefundEligibility({
      customer: baseCustomer,
      order: baseOrder,
      previousRefunds: [past1, past2],
    });

    expect(res.eligible).toBe(false);
    expect(res.decision).toBe("HUMAN_REVIEW");
  });

  it("SAFETY GUARD: process_refund MUST REFUSE execution when eligible = false", async () => {
    const res = await executeProcessRefund({
      customerId: "CUST-002",
      orderId: "ORD1002",
      amount: 50.0,
      reason: "Bypassing policy attempt",
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe("EXECUTION_REFUSED");
    expect(res.message).toContain("SAFETY VIOLATION PREVENTED");
  });
});
