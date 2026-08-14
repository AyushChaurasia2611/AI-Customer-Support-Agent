import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sessions = await prisma.agentSession.findMany({
      orderBy: { startedAt: "desc" },
      include: {
        customer: true,
        order: true,
        _count: {
          select: { events: true },
        },
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        customerId: s.customerId,
        customerName: s.customer?.name || "N/A",
        customerEmail: s.customer?.email || "N/A",
        orderId: s.orderId,
        productName: s.order?.productName || "N/A",
        orderAmount: s.order?.amount || 0,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        eventCount: s._count.events,
      })),
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to fetch sessions", details: errorMsg }, { status: 500 });
  }
}
