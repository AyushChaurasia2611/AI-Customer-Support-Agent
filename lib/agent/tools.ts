import { z } from "zod";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { evaluateRefundEligibility } from "@/lib/policy-engine";

// OpenAI Function Tool Definitions
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_customer",
      description: "Retrieve customer profile details by customerId or email address.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "Customer ID (e.g. CUST-001)" },
          email: { type: "string", description: "Customer email address" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_order",
      description: "Retrieve order details by orderId (e.g. ORD1001).",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Order ID (e.g. ORD1001)" },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_refund_history",
      description: "Retrieve refund history records for a customer and/or specific order.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "Customer ID" },
          orderId: { type: "string", description: "Order ID" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_refund_policy",
      description: "Retrieve the current e-commerce refund policy rules and constraints.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_refund_eligibility",
      description: "Deterministic business rule validation engine for refund requests. Always call this BEFORE considering refund approval.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "Customer ID" },
          orderId: { type: "string", description: "Order ID" },
          requestedAmount: { type: "number", description: "Requested refund amount in USD" },
        },
        required: ["customerId", "orderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "process_refund",
      description: "Executes an approved mock refund. MANDATORY: Only call this tool AFTER check_refund_eligibility has returned eligible: true.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "Customer ID" },
          orderId: { type: "string", description: "Order ID" },
          amount: { type: "number", description: "Refund amount to process" },
          reason: { type: "string", description: "Recorded business reason for refund" },
        },
        required: ["customerId", "orderId", "amount", "reason"],
      },
    },
  },
];

// Zod Input Validation Schemas
export const GetCustomerSchema = z.object({
  customerId: z.string().optional(),
  email: z.string().optional(),
});

export const GetOrderSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
});

export const GetRefundHistorySchema = z.object({
  customerId: z.string().optional(),
  orderId: z.string().optional(),
});

export const CheckEligibilitySchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  orderId: z.string().min(1, "orderId is required"),
  requestedAmount: z.number().optional(),
});

export const ProcessRefundSchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  orderId: z.string().min(1, "orderId is required"),
  amount: z.number().positive("Refund amount must be positive"),
  reason: z.string().min(3, "Refund reason must be specified"),
});

// Tool Implementation Functions
export async function executeGetCustomer(args: unknown) {
  const parsed = GetCustomerSchema.parse(args);
  if (!parsed.customerId && !parsed.email) {
    throw new Error("Must provide either customerId or email.");
  }

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        ...(parsed.customerId ? [{ customerId: parsed.customerId }] : []),
        ...(parsed.email ? [{ email: parsed.email }] : []),
      ],
    },
    include: {
      orders: true,
      refunds: true,
    },
  });

  if (!customer) {
    return { found: false, error: "Customer not found in database" };
  }

  return {
    found: true,
    customer: {
      id: customer.id,
      customerId: customer.customerId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      orderCount: customer.orders.length,
      orders: customer.orders.map((o) => ({ orderId: o.orderId, productName: o.productName, amount: o.amount, status: o.status })),
    },
  };
}

export async function executeGetOrder(args: unknown) {
  const parsed = GetOrderSchema.parse(args);
  const order = await prisma.order.findUnique({
    where: { orderId: parsed.orderId },
    include: {
      customer: true,
      refunds: true,
    },
  });

  if (!order) {
    return { found: false, error: `Order ${parsed.orderId} not found` };
  }

  return {
    found: true,
    order: {
      orderId: order.orderId,
      customerId: order.customerId,
      customerName: order.customer.name,
      productName: order.productName,
      productCategory: order.productCategory,
      amount: order.amount,
      currency: order.currency,
      purchaseDate: order.purchaseDate.toISOString(),
      deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString() : null,
      status: order.status,
      condition: order.condition,
      finalSale: order.finalSale,
      clearance: order.clearance,
      fraudFlag: order.fraudFlag,
      existingRefundsCount: order.refunds.length,
    },
  };
}

export async function executeGetRefundHistory(args: unknown) {
  const parsed = GetRefundHistorySchema.parse(args);
  const refunds = await prisma.refund.findMany({
    where: {
      ...(parsed.customerId ? { customerId: parsed.customerId } : {}),
      ...(parsed.orderId ? { orderId: parsed.orderId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    count: refunds.length,
    refunds: refunds.map((r) => ({
      refundId: r.refundId,
      orderId: r.orderId,
      customerId: r.customerId,
      amount: r.amount,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt ? r.processedAt.toISOString() : null,
    })),
  };
}

export async function executeGetRefundPolicy() {
  const filePath = path.join(process.cwd(), "data", "refund-policy.md");
  if (fs.existsSync(filePath)) {
    return { policy: fs.readFileSync(filePath, "utf-8") };
  }
  return {
    policy: `1. Standard products refundable within 30 days of delivery. 2. Must be unused. 3. Final sale/clearance non-refundable. 4. Max 1 refund per order. 5. Damaged products refundable within 14 days. 6. Cannot exceed original amount. 7. Fraud flagged orders ineligible. 8. Must belong to identified customer. 9. Delivered items only.`,
  };
}

export async function executeCheckRefundEligibility(args: unknown) {
  const parsed = CheckEligibilitySchema.parse(args);

  const customer = await prisma.customer.findUnique({
    where: { customerId: parsed.customerId },
  });

  const order = await prisma.order.findUnique({
    where: { orderId: parsed.orderId },
  });

  const previousRefunds = await prisma.refund.findMany({
    where: {
      OR: [
        { customerId: parsed.customerId },
        { orderId: parsed.orderId },
      ],
    },
  });

  const result = evaluateRefundEligibility({
    customer,
    order,
    previousRefunds,
    requestedAmount: parsed.requestedAmount,
    customerId: parsed.customerId,
    orderId: parsed.orderId,
  });

  return result;
}

export async function executeProcessRefund(args: unknown) {
  const parsed = ProcessRefundSchema.parse(args);

  // Safety Step 1 & 2: Fetch DB data
  const customer = await prisma.customer.findUnique({
    where: { customerId: parsed.customerId },
  });

  const order = await prisma.order.findUnique({
    where: { orderId: parsed.orderId },
  });

  const previousRefunds = await prisma.refund.findMany({
    where: {
      OR: [
        { customerId: parsed.customerId },
        { orderId: parsed.orderId },
      ],
    },
  });

  // Safety Step 3: Server-side Deterministic Eligibility Re-check!
  const eligibility = evaluateRefundEligibility({
    customer,
    order,
    previousRefunds,
    requestedAmount: parsed.amount,
    customerId: parsed.customerId,
    orderId: parsed.orderId,
  });

  // Safety Step 4: Refuse execution if NOT eligible!
  if (!eligibility.eligible) {
    return {
      success: false,
      status: "EXECUTION_REFUSED",
      message: "SAFETY VIOLATION PREVENTED: Process refund was called, but deterministic policy engine evaluated eligible = false.",
      decision: eligibility.decision,
      reasons: eligibility.reasons,
      failedChecks: eligibility.checks.filter((c) => !c.passed),
    };
  }

  // Safety Step 5: Generate Refund Record
  const refundId = `REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const refund = await prisma.refund.create({
    data: {
      refundId,
      orderId: parsed.orderId,
      customerId: parsed.customerId,
      amount: parsed.amount,
      status: "APPROVED",
      reason: parsed.reason,
      processedAt: new Date(),
    },
  });

  return {
    success: true,
    refundId: refund.refundId,
    orderId: refund.orderId,
    customerId: refund.customerId,
    amount: refund.amount,
    status: "APPROVED",
    reason: refund.reason,
    processedAt: refund.processedAt?.toISOString(),
    message: `Mock refund of $${refund.amount.toFixed(2)} processed successfully for order ${refund.orderId}.`,
  };
}
