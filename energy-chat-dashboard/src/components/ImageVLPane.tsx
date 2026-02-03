import React, { useMemo, useState } from "react";
import ChatHistory from "./ChatHistory";
import { imageVlAnalyze, resetImageVl } from "../api";
import { getDefaultUserPrompt } from "../promptConfig";

type Msg = { role: "user" | "bot"; text: string };

export default function ImageVLPane({
  model,
  onModelChange,
  installedModels,
}: {
  model: string;
  onModelChange: (m: string) => void;
  installedModels: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: "Image mode ready. Upload an image and ask a question about it." },
  ]);
  const [prompt, setPrompt] = useState<string>(() => getDefaultUserPrompt("image", model));
  const [image, setImage] = useState<File | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const canRun = useMemo(() => !!model && installedModels.includes(model), [model, installedModels]);

  async function ask() {
    const trimmed = prompt.trim();
    if (!trimmed || !image || isBusy) return;

    if (!canRun) {
      setMessages((m) => [
        ...m,
        { role: "bot", text: `Model \`${model}\` is not installed. Go to Models to download it.` },
      ]);
      return;
    }

    setIsBusy(true);
    setMessages((m) => [
      ...m,
      { role: "user", text: `**Prompt:** ${trimmed}\n\n**Image:** ${image.name}` },
      { role: "bot", text: "…" },
    ]);

    try {
      const res = await imageVlAnalyze({ prompt: trimmed, model, image });
      if (!res.ok) throw new Error(res.error || "Unknown error");

      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "bot", text: res.response ?? "" };
        return copy;
      });
    } catch (e: any) {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "bot", text: `Error: ${e?.message ?? String(e)}` };
        return copy;
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function doReset() {
    if (!model) return;
    try {
      await resetImageVl(model);
      setMessages([{ role: "bot", text: "Image session reset. New conversation." }]);
      setPrompt(getDefaultUserPrompt("image", model));
      setImage(null);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12, height: "100%", minHeight: 0 }}>
      <div className="panel">
        <div className="panel-body" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Model</label>
          <select value={model} onChange={(e) => onModelChange(e.target.value)} style={{ minWidth: 220 }}>
            {installedModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            {!installedModels.includes(model) && <option value={model}>{model} (not installed)</option>}
          </select>

          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />

          <button type="button" onClick={doReset} disabled={isBusy}>Reset</button>
        </div>
      </div>

      <ChatHistory messages={messages} isStreaming={isBusy} />

      <div className="panel">
        <div className="panel-body" style={{ display: "grid", gap: 8 }}>
          <textarea
            className="chat-text"
            style={{ minHeight: 90 }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about the image…"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={ask} disabled={isBusy || !prompt.trim() || !image}>
              {isBusy ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
