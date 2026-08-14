import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.agentSession.findUnique({
      where: { id },
      include: {
        customer: true,
        order: {
          include: {
            refunds: true,
          },
        },
        events: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Agent session not found" }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to fetch session detail", details: errorMsg }, { status: 500 });
  }
}
