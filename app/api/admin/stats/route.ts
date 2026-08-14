import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [
      totalCustomers,
      totalOrders,
      totalSessions,
      approvedRefunds,
      deniedRefunds,
      humanReviewSessions,
      totalAmountResult,
      recentSessions,
      recentEvents,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.order.count(),
      prisma.agentSession.count(),
      prisma.refund.count({ where: { status: "APPROVED" } }),
      prisma.refund.count({ where: { status: "DENIED" } }),
      prisma.agentSession.count({ where: { status: "HUMAN_REVIEW" } }),
      prisma.refund.aggregate({
        where: { status: "APPROVED" },
        _sum: { amount: true },
      }),
      prisma.agentSession.findMany({
        take: 10,
        orderBy: { startedAt: "desc" },
        include: {
          customer: true,
          order: true,
          events: {
            take: 3,
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.agentEvent.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalCustomers,
        totalOrders,
        totalSessions,
        approvedRefunds,
        deniedRefunds,
        humanReviewSessions,
        totalRefundAmount: totalAmountResult._sum.amount || 0,
      },
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        customerId: s.customerId,
        customerName: s.customer?.name || "Unknown",
        orderId: s.orderId,
        productName: s.order?.productName || "N/A",
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        eventCount: s.events.length,
      })),
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        type: e.type,
        toolName: e.toolName,
        status: e.status,
        message: e.message,
        createdAt: e.createdAt,
      })),
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to fetch admin stats", details: errorMsg }, { status: 500 });
  }
}
