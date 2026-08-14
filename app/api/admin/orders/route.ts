import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { orderId: "asc" },
      include: {
        customer: true,
        refunds: true,
      },
    });

    return NextResponse.json({ orders });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to fetch orders", details: errorMsg }, { status: 500 });
  }
}
