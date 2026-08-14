import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const refunds = await prisma.refund.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        order: true,
      },
    });

    return NextResponse.json({ refunds });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to fetch refunds", details: errorMsg }, { status: 500 });
  }
}
