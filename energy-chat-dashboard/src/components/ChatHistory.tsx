import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "bot"; text: string };
type Props = {
  messages: Msg[];
  isStreaming?: boolean;
  thinkingMode?: "fast" | "deep";
};

// Rotating thinking messages for deep thinking mode
const THINKING_MESSAGES = [
  "Analyzing the question...",
  "Retrieving relevant knowledge...",
  "Evaluating possible approaches...",
  "Organizing the response...",
  "Composing final answer...",
];

export default function ChatHistory({ messages, isStreaming = false, thinkingMode = "fast" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);

  useEffect(() => {
    ref.current?.scrollTo({
      top: ref.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  // Rotate thinking messages every 10 seconds during deep thinking
  useEffect(() => {
    if (!isStreaming || thinkingMode !== "deep") {
      setThinkingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setThinkingMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [isStreaming, thinkingMode]);

  return (
    <div className="chat-history" ref={ref} aria-label="Chat history">
      {messages.map((m, i) => (
        <div key={i} className={`chat-bubble ${m.role}`}>
          <div className="bubble">
            <ReactMarkdown
              components={{
                strong: ({ node, ...props }) => (
                  <strong className="markdown-bold" {...props} />
                ),
                em: ({ node, ...props }) => (
                  <em className="markdown-italic" {...props} />
                ),
                h1: ({ node, ...props }) => (
                  <h1 className="markdown-h1" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="markdown-h2" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="markdown-ul" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="markdown-ol" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="markdown-li" {...props} />
                ),
                code: ({ node, ...props }) => (
                  <pre className="markdown-code-block">
                    <code {...props} />
                  </pre>
                ),
              }}
            >
              {m.text}
            </ReactMarkdown>
          </div>
        </div>
      ))}

      {isStreaming && (
        <div className="chat-bubble bot">
            <div
            className="bubble typing-indicator"
            aria-label="Assistant is responding"
            >
                {thinkingMode === "deep" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontStyle: "italic", opacity: 0.9 }}>
                      {THINKING_MESSAGES[thinkingMessageIndex]}
                    </span>
                    <span className="thinking-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  </div>
                ) : (
                  <>
                    <span></span>
                    <span></span>
                    <span></span>
                  </>
                )}
            </div>
        </div>
        )}
    </div>
  );
}
