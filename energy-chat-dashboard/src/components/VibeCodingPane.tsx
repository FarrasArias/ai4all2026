import React, { useState, useRef } from "react";
import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";
import { vibeCode, resetVibe } from "../api";

type Msg = { role: "user" | "bot"; text: string };

type Props = {
  model?: string;
};

export default function VibeCodingPane({ model }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text:
        "Welcome to Vibe Coding.\n\nPaste code or describe a coding task, and I'll help debug, refactor, or implement it.",
    },
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeModel = model;

  // Copy last response to clipboard
  async function handleCopyLastResponse() {
    const lastBot = [...messages].reverse().find((m) => m.role === "bot");
    if (!lastBot) return;
    try {
      await navigator.clipboard.writeText(lastBot.text);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setCopyStatus("Failed to copy");
      setTimeout(() => setCopyStatus(null), 2000);
    }
  }

  // Save last response to file (default .py)
  function handleSaveLastResponse() {
    const lastBot = [...messages].reverse().find((m) => m.role === "bot");
    if (!lastBot) return;

    // Extract code blocks if present, otherwise save full response
    const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;
    let contentToSave = lastBot.text;
    const codeBlocks: string[] = [];
    let match;
    while ((match = codeBlockRegex.exec(lastBot.text)) !== null) {
      codeBlocks.push(match[1].trim());
    }
    if (codeBlocks.length > 0) {
      contentToSave = codeBlocks.join("\n\n");
    }

    const blob = new Blob([contentToSave], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code_response_${Date.now()}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Clear loaded files
  function handleClearFiles() {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !activeModel) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setIsLoading(true);

    try {
      const res = await vibeCode({ prompt: trimmed, model: activeModel, files });
      if (res && res.ok && res.response) {
        setMessages((prev) => [...prev, { role: "bot", text: res.response as string }]);
      } else {
        const err = (res && res.error) || "No response from coding assistant.";
        setMessages((prev) => [...prev, { role: "bot", text: `⚠️ ${err}` }]);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Sorry, something went wrong while talking to the coding model.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReset() {
    if (!activeModel) return;
    try {
      await resetVibe(activeModel);
    } catch (err) {
      console.error("Failed to reset vibe coding session", err);
    }
    setMessages([
      {
        role: "bot",
        text:
          "Coding context was reset. Paste new code or describe a new task to start again.",
      },
    ]);
    setFiles([]);
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
            <div style={{ fontWeight: 500 }}>Vibe Coding</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Model: {activeModel || "loading default model…"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".py,.ts,.tsx,.js,.jsx,.java,.cs,.cpp,.c,.go,.rs,.rb,.php,.html,.css,.json,.txt"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <>
                <span style={{ fontSize: 12, opacity: 0.8 }}>
                  {files.length} file{files.length > 1 ? "s" : ""} loaded
                </span>
                <button type="button" onClick={handleClearFiles} title="Clear loaded files">
                  Clear files
                </button>
              </>
            )}
            <button type="button" onClick={handleReset} disabled={!activeModel}>
              Reset session
            </button>
            <button
              type="button"
              onClick={handleCopyLastResponse}
              disabled={messages.filter(m => m.role === "bot").length === 0}
              title="Copy last response to clipboard"
            >
              {copyStatus || "Copy response"}
            </button>
            <button
              type="button"
              onClick={handleSaveLastResponse}
              disabled={messages.filter(m => m.role === "bot").length === 0}
              title="Save last response as .py file"
            >
              Save as .py
            </button>
          </div>
        </div>
      </div>

      <ChatHistory messages={messages} isStreaming={isLoading} />

      <ChatInput onSend={handleSend} />
    </div>
  );
}
