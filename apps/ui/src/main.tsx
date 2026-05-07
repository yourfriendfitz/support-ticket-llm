import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

type ChatResponse = {
  status: "ok" | "error";
  answer?: string;
  error?: string;
  citations?: Array<{
    ticketId: string;
    title: string;
    service: string;
    environment: string;
    status: string;
    priority: string;
    createdAt: string;
    score: number;
    matchReasons: string[];
  }>;
  diagnostics?: {
    mcp?: {
      service: string;
      status: string;
      timestamp: string;
    };
    retrieval?: {
      totalTickets: number;
      filteredTickets: number;
      returnedTickets: number;
      strategy: string;
    };
  };
};

function App() {
  const [message, setMessage] = useState("Give me the latest ticket about Lambda timeouts");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitMessage() {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setResponse(null);

    try {
      const result = await fetch(`${apiBaseUrl}/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ message: trimmedMessage })
      });

      setResponse((await result.json()) as ChatResponse);
    } catch (error) {
      setResponse({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown request failure"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Support Operations</p>
        <h1 id="page-title">Ticket intelligence with bounded LLM orchestration.</h1>
        <p className="lede">
          Milestone 2 proves local ticket retrieval: UI to API to MCP search with cited
          candidates. Tiny-model inference comes next.
        </p>
      </section>

      <section className="chat-panel" aria-label="Chat">
        <label htmlFor="message">Ask about support tickets</label>
        <textarea
          id="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
        />
        <button type="button" onClick={submitMessage} disabled={isSubmitting}>
          {isSubmitting ? "Searching tickets..." : "Search tickets"}
        </button>

        {response ? (
          <article className={`response response--${response.status}`}>
            <h2>{response.status === "ok" ? "Service path online" : "Request failed"}</h2>
            <p>{response.answer ?? response.error}</p>
            {response.citations && response.citations.length > 0 ? (
              <ol className="citations" aria-label="Matching tickets">
                {response.citations.map((citation) => (
                  <li key={citation.ticketId}>
                    <div className="citation__header">
                      <span>{citation.ticketId}</span>
                      <span>{citation.priority}</span>
                    </div>
                    <strong>{citation.title}</strong>
                    <p>
                      {citation.service} / {citation.environment} / {citation.status}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
            {response.diagnostics?.mcp ? (
              <dl>
                <div>
                  <dt>MCP service</dt>
                  <dd>{response.diagnostics.mcp.service}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{response.diagnostics.mcp.status}</dd>
                </div>
              </dl>
            ) : null}
            {response.diagnostics?.retrieval ? (
              <dl>
                <div>
                  <dt>Tickets searched</dt>
                  <dd>{response.diagnostics.retrieval.filteredTickets}</dd>
                </div>
                <div>
                  <dt>Returned</dt>
                  <dd>{response.diagnostics.retrieval.returnedTickets}</dd>
                </div>
              </dl>
            ) : null}
          </article>
        ) : null}
      </section>
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
