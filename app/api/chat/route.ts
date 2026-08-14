import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgentLoop } from "@/lib/agent/runner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, customerId, orderId } = body;
    let { sessionId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message string is required" }, { status: 400 });
    }

    // Retrieve or create active session
    if (!sessionId) {
      const newSession = await prisma.agentSession.create({
        data: {
          customerId: customerId || null,
          orderId: orderId || null,
          status: "ACTIVE",
        },
      });
      sessionId = newSession.id;
    } else {
      const existingSession = await prisma.agentSession.findUnique({
        where: { id: sessionId },
      });
      if (!existingSession) {
        const newSession = await prisma.agentSession.create({
          data: {
            id: sessionId,
            customerId: customerId || null,
            orderId: orderId || null,
            status: "ACTIVE",
          },
        });
        sessionId = newSession.id;
      }
    }

    // Execute agent loop
    const result = await runAgentLoop({
      sessionId,
      userMessage: message,
      customerId,
      orderId,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in /api/chat route:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: errorMsg,
        decision: "HUMAN_REVIEW",
        response: "An internal server error occurred while processing your request. Please try again.",
      },
      { status: 500 }
    );
  }
}
