import React, { useState } from "react";
import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";
import { webChat, resetWeb } from "../api";

type Msg = { role: "user" | "bot"; text: string };

type Props = {
  model?: string;
};

export default function WebChatPane({ model }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text:
        "This mode can use web tools. Ask a question and I'll search the web when it helps answer accurately.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const activeModel = model;

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !activeModel) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setIsLoading(true);

    try {
      const res = await webChat({ prompt: trimmed, model: activeModel });
      if (res && res.ok && res.response) {
        setMessages((prev) => [...prev, { role: "bot", text: res.response as string }]);
      } else {
        const err = (res && res.error) || "No response from web model.";
        setMessages((prev) => [...prev, { role: "bot", text: `⚠️ ${err}` }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Sorry, something went wrong while calling the web-enabled model.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReset() {
    if (!activeModel) return;
    try {
      await resetWeb(activeModel);
    } catch (err) {
      console.error("Failed to reset web session", err);
    }
    setMessages([
      {
        role: "bot",
        text: "Web chat context was reset. Ask a new question to start a fresh session.",
      },
    ]);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 12,
        height: "100%",
        minHeight: 0,
      }}
    >
      <div className="panel">
        <div
          className="panel-body"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 500 }}>Web</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Model: {activeModel || "loading default model…"}
            </div>
          </div>
          <button type="button" onClick={handleReset} disabled={!activeModel}>
            Reset web session
          </button>
        </div>
      </div>

      <ChatHistory messages={messages} isStreaming={isLoading} />

      <ChatInput onSend={handleSend} />
    </div>
  );
}
