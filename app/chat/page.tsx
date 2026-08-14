"use client";

import { useState, useEffect, useRef } from "react";
import {
  Send,
  User,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Mic,
  MicOff,
  RotateCcw,
  ShieldAlert,
  Loader2,
  ChevronDown,
  DollarSign,
  Package,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  decision?: "APPROVED" | "DENIED" | "HUMAN_REVIEW" | "PROCESSING" | "INFO_REQUESTED";
  refundId?: string;
  refundAmount?: number;
  events?: Array<{
    type: string;
    toolName?: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface CustomerOption {
  customerId: string;
  name: string;
  email: string;
  orderId: string;
  productName: string;
  amount: number;
  condition: string;
  scenarioTitle: string;
  expectedDecision: "APPROVED" | "DENIED" | "HUMAN_REVIEW";
}

const DEMO_SCENARIOS: CustomerOption[] = [
  {
    customerId: "CUST-001",
    name: "Alice Smith",
    email: "alice.smith@example.com",
    orderId: "ORD1001",
    productName: "Pro Audio Noise-Canceling Headphones",
    amount: 120.0,
    condition: "UNUSED",
    scenarioTitle: "DEMO 1 — Standard Eligible Refund",
    expectedDecision: "APPROVED",
  },
  {
    customerId: "CUST-002",
    name: "Bob Jones",
    email: "bob.jones@example.com",
    orderId: "ORD1002",
    productName: "Italian Genuine Leather Wallet",
    amount: 50.0,
    condition: "UNUSED",
    scenarioTitle: "DEMO 2 — Refund Window Expired (>30 Days)",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-003",
    name: "Charlie Brown",
    email: "charlie.brown@example.com",
    orderId: "ORD1003",
    productName: "Designer Winter Parka",
    amount: 200.0,
    condition: "UNUSED",
    scenarioTitle: "DEMO 3 — Final Sale Product",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-004",
    name: "Diana Prince",
    email: "diana.prince@example.com",
    orderId: "ORD1004",
    productName: "RGB Mechanical Gaming Keyboard",
    amount: 150.0,
    condition: "UNUSED",
    scenarioTitle: "DEMO 4 — Already Refunded Order",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-005",
    name: "Evan Wright",
    email: "evan.wright@example.com",
    orderId: "ORD1005",
    productName: "Artisanal Ceramic Coffee Press",
    amount: 60.0,
    condition: "DAMAGED",
    scenarioTitle: "DEMO 5 — Damaged Product Eligible (14-Day Window)",
    expectedDecision: "APPROVED",
  },
  {
    customerId: "CUST-006",
    name: "Fiona Gallagher",
    email: "fiona.g@example.com",
    orderId: "ORD1006",
    productName: "Ultra Fitness Smartwatch",
    amount: 250.0,
    condition: "USED",
    scenarioTitle: "CUSTOMER 06 — Used Product Condition",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-007",
    name: "George Harris",
    email: "george.h@example.com",
    orderId: "ORD1007",
    productName: "Wireless Charging Pad",
    amount: 35.0,
    condition: "UNUSED",
    scenarioTitle: "CUSTOMER 07 — Order Ownership Mismatch",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-008",
    name: "Hannah Abbott",
    email: "hannah.a@example.com",
    orderId: "ORD1008",
    productName: "Ergonomic Mesh Office Chair",
    amount: 350.0,
    condition: "UNUSED",
    scenarioTitle: "CUSTOMER 08 — Undelivered Order",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-009",
    name: "Ian Malcolm",
    email: "ian.m@example.com",
    orderId: "ORD1009",
    productName: "Flagship 5G Smartphone",
    amount: 999.0,
    condition: "UNUSED",
    scenarioTitle: "CUSTOMER 09 — Fraud Flagged Order",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-010",
    name: "Julia Roberts",
    email: "julia.r@example.com",
    orderId: "ORD1010",
    productName: "Compact Portable Speaker",
    amount: 80.0,
    condition: "UNUSED",
    scenarioTitle: "CUSTOMER 10 — Amount Exceeds Allowed Limit",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-011",
    name: "Kevin Bacon",
    email: "kevin.b@example.com",
    orderId: "ORD1011",
    productName: "True Wireless Earbuds",
    amount: 90.0,
    condition: "UNUSED",
    scenarioTitle: "CUSTOMER 11 — Recently Delivered Eligible",
    expectedDecision: "APPROVED",
  },
  {
    customerId: "CUST-012",
    name: "Laura Croft",
    email: "laura.c@example.com",
    orderId: "ORD1012",
    productName: "Clearance Trench Coat",
    amount: 110.0,
    condition: "UNUSED",
    scenarioTitle: "CUSTOMER 12 — Clearance Item Policy",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-013",
    name: "Michael Scott",
    email: "michael.s@example.com",
    orderId: "ORD1013",
    productName: "Handblown Crystal Glass Vase",
    amount: 75.0,
    condition: "DAMAGED",
    scenarioTitle: "CUSTOMER 13 — Damaged Item Outside 14-Day Window",
    expectedDecision: "DENIED",
  },
  {
    customerId: "CUST-014",
    name: "Nancy Drew",
    email: "nancy.d@example.com",
    orderId: "ORD1014",
    productName: "HD Security Camera Pack",
    amount: 180.0,
    condition: "USED",
    scenarioTitle: "CUSTOMER 14 — Multiple Past Attempts",
    expectedDecision: "HUMAN_REVIEW",
  },
  {
    customerId: "CUST-015",
    name: "Oscar Martinez",
    email: "oscar.m@example.com",
    orderId: "ORD1015",
    productName: "Stainless Steel Cookware Set",
    amount: 100.0,
    condition: "UNUSED",
    scenarioTitle: "CUSTOMER 15 — Partial Refund Request",
    expectedDecision: "APPROVED",
  },
];

export default function ChatPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption>(DEMO_SCENARIOS[0]);
  const [inputMessage, setInputMessage] = useState("");
  const [sessionId, setSessionId] = useState<string>("sess-initial");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-welcome",
      sender: "agent",
      text: `Hello ${DEMO_SCENARIOS[0].name}! I am Apex AI, your e-commerce support specialist. How can I assist you with order ${DEMO_SCENARIOS[0].orderId} (${DEMO_SCENARIOS[0].productName}) today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const switchCustomer = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    const newSessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setSessionId(newSessionId);
    setMessages([
      {
        id: "msg-welcome",
        sender: "agent",
        text: `Hello ${customer.name}! I am Apex AI, your e-commerce support specialist. How can I assist you with order ${customer.orderId} (${customer.productName}) today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setApiError(null);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, activeTool]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage("");
    setIsLoading(true);
    setActiveTool("Evaluating query...");
    setApiError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          customerId: selectedCustomer.customerId,
          orderId: selectedCustomer.orderId,
        }),
      });

      const data = await res.json();

      if (!res.ok && data.error && data.error.includes("OPENAI_API_KEY")) {
        setApiError(data.response || data.details);
      }

      const agentMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "agent",
        text: data.response || "I have processed your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        decision: data.decision,
        refundId: data.refundId,
        refundAmount: data.refundAmount,
        events: data.events,
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setApiError(`Network or Server error: ${msg}`);
    } finally {
      setIsLoading(false);
      setActiveTool(null);
    }
  };

  // Optional Voice Input (Web Speech API)
  const toggleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition is not supported by your current browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    interface SpeechRecognitionEvent {
      results: Array<Array<{ transcript: string }>>;
    }

    interface SpeechRecognitionInstance {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: () => void;
      onresult: (event: SpeechRecognitionEvent) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    }

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };

    const SpeechRecognitionClass = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col p-4 sm:p-6 lg:p-8 gap-4">
      {/* Top Demo Bar / Customer Selector */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md shadow-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Active Customer Context</h2>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-mono">
                  {selectedCustomer.customerId}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {selectedCustomer.name} ({selectedCustomer.email}) • Order: <span className="font-mono text-indigo-300">{selectedCustomer.orderId}</span> (${selectedCustomer.amount.toFixed(2)})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 md:w-80">
              <select
                value={selectedCustomer.customerId}
                onChange={(e) => {
                  const found = DEMO_SCENARIOS.find((c) => c.customerId === e.target.value);
                  if (found) switchCustomer(found);
                }}
                className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-950 py-2 pl-3 pr-8 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                {DEMO_SCENARIOS.map((scenario) => (
                  <option key={scenario.customerId} value={scenario.customerId}>
                    {scenario.scenarioTitle}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
            </div>

            <button
              onClick={() => switchCustomer(selectedCustomer)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Chat
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-md">
        {/* API Key Missing Alert banner if any */}
        {apiError && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
              <span>{apiError}</span>
            </div>
            <button
              onClick={() => handleSendMessage("Request refund for my recent order")}
              className="rounded bg-amber-600/30 px-2 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-600/50"
            >
              Retry
            </button>
          </div>
        )}

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {msg.sender === "user" ? "Customer" : "Apex AI Support Agent"}
                </span>
                <span className="text-[10px] text-slate-600">{msg.timestamp}</span>
              </div>

              <div
                className={`relative max-w-2xl rounded-2xl px-4 py-3 text-sm shadow-md ${
                  msg.sender === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-none"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                {/* Agent Tool Traces summary inside message */}
                {msg.events && msg.events.length > 0 && (
                  <div className="mt-3 border-t border-slate-800/80 pt-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400">
                      <Sparkles className="h-3 w-3" />
                      Agent Tool Executions ({msg.events.filter((e) => e.type === "TOOL_CALL").length} tools invoked):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.events
                        .filter((e) => e.type === "TOOL_CALL")
                        .map((evt, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-950 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-800"
                          >
                            <Package className="h-2.5 w-2.5 text-indigo-400" />
                            {evt.toolName}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Refund Status Pill / Badge */}
                {msg.decision && msg.decision !== "PROCESSING" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-2.5">
                    {msg.decision === "APPROVED" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Decision: APPROVED
                      </span>
                    )}

                    {msg.decision === "DENIED" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/30">
                        <XCircle className="h-3.5 w-3.5 text-rose-400" />
                        Decision: DENIED
                      </span>
                    )}

                    {msg.decision === "HUMAN_REVIEW" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/30">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        Decision: HUMAN REVIEW
                      </span>
                    )}

                    {msg.refundId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-mono text-indigo-300 border border-indigo-500/30">
                        <DollarSign className="h-3.5 w-3.5 text-indigo-400" />
                        Refund ID: {msg.refundId} (${msg.refundAmount?.toFixed(2)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading / Tool execution state indicator */}
          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Apex AI Support Agent
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 border border-slate-800 text-slate-300 text-xs shadow-md">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-slate-200">Orchestrating backend tools...</span>
                  <span className="text-[11px] font-mono text-slate-400">{activeTool || "Querying database..."}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Suggestion Prompts */}
        <div className="border-t border-slate-900 bg-slate-950/60 p-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-400" /> Quick Prompts:
            </span>
            <button
              onClick={() => handleSendMessage(`I would like to request a refund for my recent order ${selectedCustomer.orderId}.`)}
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-indigo-500/40 hover:bg-slate-800 transition"
            >
              &quot;Request refund for {selectedCustomer.orderId}&quot;
            </button>
            <button
              onClick={() => handleSendMessage(`Can you check the current status of order ${selectedCustomer.orderId}?`)}
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-indigo-500/40 hover:bg-slate-800 transition"
            >
              &quot;Check order status&quot;
            </button>
            <button
              onClick={() => handleSendMessage("What is your refund policy regarding returned items?")}
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-indigo-500/40 hover:bg-slate-800 transition"
            >
              &quot;Check refund policy&quot;
            </button>
          </div>
        </div>

        {/* Message Input Controls */}
        <div className="border-t border-slate-800 bg-slate-900/90 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                isListening
                  ? "border-rose-500 bg-rose-500/20 text-rose-400 animate-pulse"
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Toggle Voice Input (Web Speech API)"
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask Apex AI about refund for order ${selectedCustomer.orderId}...`}
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none shadow-inner"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
