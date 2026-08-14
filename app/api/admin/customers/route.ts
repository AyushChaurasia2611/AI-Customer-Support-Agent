import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { customerId: "asc" },
      include: {
        orders: true,
        refunds: true,
      },
    });

    return NextResponse.json({ customers });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to fetch customers", details: errorMsg }, { status: 500 });
  }
}
