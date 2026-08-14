import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import {
  TOOL_DEFINITIONS,
  executeGetCustomer,
  executeGetOrder,
  executeGetRefundHistory,
  executeGetRefundPolicy,
  executeCheckRefundEligibility,
  executeProcessRefund,
} from "@/lib/agent/tools";

export interface AgentRunParams {
  sessionId: string;
  userMessage: string;
  customerId?: string;
  orderId?: string;
}

export interface AgentRunResult {
  sessionId: string;
  response: string;
  decision: "APPROVED" | "DENIED" | "HUMAN_REVIEW" | "PROCESSING" | "INFO_REQUESTED";
  refundId?: string;
  refundAmount?: number;
  events: Array<{
    type: string;
    toolName?: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
}

// Helper to log safe execution events
async function logAgentEvent(
  sessionId: string,
  type: string,
  message: string,
  toolName?: string,
  status?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type,
        toolName,
        status,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    console.error("Failed to persist AgentEvent:", err);
  }
}

export async function runAgentLoop(params: AgentRunParams): Promise<AgentRunResult> {
  const { sessionId, userMessage, customerId, orderId } = params;

  // Verify OpenAI API Key configuration
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    const errorMsg = "OPENAI_API_KEY is not configured in environment variables (.env). Please set a valid API key to run the agent.";
    await logAgentEvent(sessionId, "TOOL_ERROR", errorMsg, undefined, "MISSING_KEY");
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "FAILED", completedAt: new Date() },
    });
    return {
      sessionId,
      response: "⚠️ Configuration Error: The OpenAI API Key is missing. Please add OPENAI_API_KEY to your .env file to enable AI customer support interactions.",
      decision: "PROCESSING",
      events: [{ type: "TOOL_ERROR", message: errorMsg }],
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseURL = process.env.OPENAI_API_BASE_URL || undefined;
  const openai = new OpenAI({ apiKey, baseURL });

  // Update session context
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: {
      customerId: customerId || undefined,
      orderId: orderId || undefined,
      status: "ACTIVE",
    },
  });

  // Log incoming user message
  await logAgentEvent(sessionId, "USER_MESSAGE", `Customer message: "${userMessage}"`, undefined, "RECEIVED", {
    customerId,
    orderId,
  });

  await logAgentEvent(sessionId, "AGENT_STARTED", `Agent loop initiated with model ${model}`, undefined, "RUNNING");

  // Fetch session history events to build message list
  const previousEvents = await prisma.agentEvent.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  // Build OpenAI Messages array
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Context injection for pre-selected customer/order if provided via UI
  if (customerId || orderId) {
    messages.push({
      role: "system",
      content: `Context: Active CustomerId is '${customerId || "not specified"}', Active OrderId is '${orderId || "not specified"}'.`,
    });
  }

  // Replay message history
  for (const event of previousEvents) {
    if (event.type === "USER_MESSAGE") {
      messages.push({ role: "user", content: event.message.replace(/^Customer message: "/, "").replace(/"$/, "") });
    }
  }

  const MAX_ITERATIONS = 8;
  let iteration = 0;
  let finalDecision: "APPROVED" | "DENIED" | "HUMAN_REVIEW" | "PROCESSING" | "INFO_REQUESTED" = "PROCESSING";
  let processedRefundId: string | undefined = undefined;
  let processedRefundAmount: number | undefined = undefined;

  const toolRetryCounts: Record<string, number> = {};

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.1,
      });

      const choice = response.choices[0];
      const responseMessage = choice.message;

      // If model wants to call tools
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type !== "function") continue;
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};

          try {
            toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            toolArgs = {};
          }

          // Inject customerId / orderId from context if omitted by model
          if (customerId && !toolArgs.customerId) toolArgs.customerId = customerId;
          if (orderId && !toolArgs.orderId) toolArgs.orderId = orderId;

          await logAgentEvent(
            sessionId,
            "TOOL_CALL",
            `Calling tool '${toolName}' with arguments: ${JSON.stringify(toolArgs)}`,
            toolName,
            "EXECUTING",
            toolArgs
          );

          let toolOutput: unknown;
          let toolError = false;

          try {
            if (toolName === "get_customer") {
              toolOutput = await executeGetCustomer(toolArgs);
            } else if (toolName === "get_order") {
              toolOutput = await executeGetOrder(toolArgs);
            } else if (toolName === "get_refund_history") {
              toolOutput = await executeGetRefundHistory(toolArgs);
            } else if (toolName === "get_refund_policy") {
              toolOutput = await executeGetRefundPolicy();
            } else if (toolName === "check_refund_eligibility") {
              toolOutput = await executeCheckRefundEligibility(toolArgs);
              const eligResult = toolOutput as { eligible: boolean; decision: string; reasons: string[] };
              
              if (eligResult.eligible) {
                finalDecision = "APPROVED";
                await logAgentEvent(sessionId, "POLICY_CHECK", `Policy Engine Result: ELIGIBLE (${eligResult.decision})`, toolName, "PASSED", eligResult);
              } else if (eligResult.decision === "HUMAN_REVIEW") {
                finalDecision = "HUMAN_REVIEW";
                await logAgentEvent(sessionId, "HUMAN_REVIEW", `Policy Engine Result: HUMAN_REVIEW - ${eligResult.reasons.join("; ")}`, toolName, "REVIEW_REQUIRED", eligResult);
              } else {
                finalDecision = "DENIED";
                await logAgentEvent(sessionId, "REFUND_DENIED", `Policy Engine Result: INELIGIBLE - ${eligResult.reasons.join("; ")}`, toolName, "FAILED", eligResult);
              }
            } else if (toolName === "process_refund") {
              toolOutput = await executeProcessRefund(toolArgs);
              const procResult = toolOutput as { success: boolean; refundId?: string; amount?: number; message?: string };
              
              if (procResult.success) {
                finalDecision = "APPROVED";
                processedRefundId = procResult.refundId;
                processedRefundAmount = procResult.amount;
                await logAgentEvent(sessionId, "REFUND_PROCESSED", `Refund execution successful: ${procResult.refundId} ($${procResult.amount})`, toolName, "SUCCESS", procResult);
              } else {
                finalDecision = "DENIED";
                await logAgentEvent(sessionId, "TOOL_ERROR", `Refund execution refused by safety guard: ${procResult.message}`, toolName, "BLOCKED", procResult);
              }
            } else {
              toolOutput = { error: `Unknown tool: ${toolName}` };
              toolError = true;
            }

            await logAgentEvent(
              sessionId,
              toolError ? "TOOL_ERROR" : "TOOL_RESULT",
              `Tool '${toolName}' execution output: ${JSON.stringify(toolOutput)}`,
              toolName,
              toolError ? "FAILED" : "SUCCESS"
            );
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            toolRetryCounts[toolName] = (toolRetryCounts[toolName] || 0) + 1;

            if (toolRetryCounts[toolName] <= 2) {
              await logAgentEvent(
                sessionId,
                "RETRY",
                `Tool '${toolName}' failed (${errorMsg}). Retrying (Attempt ${toolRetryCounts[toolName]}/2)...`,
                toolName,
                "RETRYING"
              );
              toolOutput = { error: `Execution failed. Retrying... Details: ${errorMsg}` };
            } else {
              finalDecision = "HUMAN_REVIEW";
              await logAgentEvent(
                sessionId,
                "HUMAN_REVIEW",
                `Tool '${toolName}' failed after 2 retries. Transitioning request to HUMAN_REVIEW.`,
                toolName,
                "MAX_RETRIES_EXCEEDED"
              );
              toolOutput = { error: "Max retries exceeded. Request transferred to human agent review.", status: "HUMAN_REVIEW" };
            }
          }

          // Return tool result to message history for next turn
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolOutput),
          });
        }
      } else {
        // Model provided final text response
        const assistantText = responseMessage.content || "I have reviewed your request.";
        
        await logAgentEvent(sessionId, "DECISION", `Final Agent Response generated (${finalDecision})`, undefined, finalDecision, {
          decision: finalDecision,
          refundId: processedRefundId,
        });

        await logAgentEvent(sessionId, "AGENT_COMPLETED", "Agent session execution completed", undefined, "COMPLETED");

        await prisma.agentSession.update({
          where: { id: sessionId },
          data: {
            status: finalDecision === "PROCESSING" ? "COMPLETED" : finalDecision,
            completedAt: new Date(),
          },
        });

        const updatedEvents = await prisma.agentEvent.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
        });

        return {
          sessionId,
          response: assistantText,
          decision: finalDecision,
          refundId: processedRefundId,
          refundAmount: processedRefundAmount,
          events: updatedEvents.map((e) => ({
            type: e.type,
            toolName: e.toolName || undefined,
            message: e.message,
            metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
          })),
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await logAgentEvent(sessionId, "TOOL_ERROR", `OpenAI API Error: ${errorMsg}`, undefined, "API_ERROR");

      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: "FAILED", completedAt: new Date() },
      });

      return {
        sessionId,
        response: `I encountered an unexpected system error while communicating with our support backend (${errorMsg}). Your request has been logged for manual human review.`,
        decision: "HUMAN_REVIEW",
        events: [{ type: "TOOL_ERROR", message: errorMsg }],
      };
    }
  }

  // Iteration limit reached
  await logAgentEvent(sessionId, "HUMAN_REVIEW", "Maximum agent iterations reached (8). Transitioning to HUMAN_REVIEW.", undefined, "MAX_ITERATIONS");

  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status: "HUMAN_REVIEW", completedAt: new Date() },
  });

  return {
    sessionId,
    response: "Your refund request required an extensive investigation and has been forwarded to our senior Human Specialist team for manual processing. We will follow up via email shortly.",
    decision: "HUMAN_REVIEW",
    events: [],
  };
}
