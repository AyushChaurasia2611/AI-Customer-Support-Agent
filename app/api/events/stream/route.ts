import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  let isConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Start polling after the newest existing event so the first poll
      // doesn't re-send events the client already received from the stats snapshot.
      const latest = await prisma.agentEvent.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      let lastCheckedAt: Date | null = latest?.createdAt ?? null;

      // Send initial heartbeat
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: new Date() })}\n\n`));

      const interval = setInterval(async () => {
        if (!isConnected) {
          clearInterval(interval);
          return;
        }

        try {
          const events = await prisma.agentEvent.findMany({
            where: lastCheckedAt ? { createdAt: { gte: lastCheckedAt } } : undefined,
            take: 20,
            orderBy: { createdAt: "asc" },
            include: {
              session: {
                include: {
                  customer: true,
                },
              },
            },
          });

          if (events.length > 0) {
            lastCheckedAt = events[events.length - 1].createdAt;
            for (const event of events) {
              const payload = {
                id: event.id,
                sessionId: event.sessionId,
                customerName: event.session.customer?.name || "Anonymous",
                type: event.type,
                toolName: event.toolName,
                status: event.status,
                message: event.message,
                metadata: event.metadata ? JSON.parse(event.metadata) : null,
                createdAt: event.createdAt,
              };
              controller.enqueue(encoder.encode(`event: event\ndata: ${JSON.stringify(payload)}\n\n`));
            }
          } else {
            // Heartbeat
            controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
          }
        } catch (err) {
          console.error("SSE polling error:", err);
        }
      }, 1000);

      // Clean up interval when client disconnects
      return () => {
        isConnected = false;
        clearInterval(interval);
      };
    },
    cancel() {
      isConnected = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
