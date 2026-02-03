import React, { useState } from "react";
import { streamImageAnalysis } from "../api";

type Turn = {
  prompt: string;
  response: string | null;
};

type Props = {
  model?: string;
};

export default function ImageAnalysisPane({ model }: Props) {
  const [image, setImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>("Describe this image.");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const activeModel = model;

  async function handleAnalyze() {
    if (!image || !activeModel || !prompt.trim()) return;

    const currentPrompt = prompt.trim();

    // Add new turn and get its index
    setTurns((prev) => [...prev, { prompt: currentPrompt, response: "" }]);
    setIsStreaming(true);

    // Use a ref-like approach: accumulate response locally, then update state
    let accumulatedResponse = "";

    try {
      await streamImageAnalysis(
        { prompt: currentPrompt, model: activeModel, image },
        (delta: string) => {
          accumulatedResponse += delta;
          // Update the last turn's response
          setTurns((prev) => {
            const next = [...prev];
            const lastIndex = next.length - 1;
            if (lastIndex >= 0) {
              next[lastIndex] = { ...next[lastIndex], response: accumulatedResponse };
            }
            return next;
          });
        },
      );
    } catch (err) {
      console.error(err);
      setTurns((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        if (lastIndex >= 0) {
          next[lastIndex] = {
            prompt: currentPrompt,
            response: "Sorry, something went wrong while analyzing the image.",
          };
        }
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  const lastTurn = turns[turns.length - 1];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto auto 1fr",
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
            <div style={{ fontWeight: 500 }}>Image analysis</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Model: {activeModel || "loading default model…"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
            <button type="button" onClick={handleAnalyze} disabled={!image || !activeModel}>
              Analyze image
            </button>
          </div>
        </div>
      </div>

      {image && (
        <div className="panel">
          <div className="panel-body" style={{ display: "flex", justifyContent: "center" }}>
            <img
              src={URL.createObjectURL(image)}
              alt="Selected"
              style={{ maxHeight: 200, maxWidth: "100%", objectFit: "contain" }}
            />
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-body" style={{ height: "100%", overflow: "auto" }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Prompt
            </label>
            <textarea
              style={{ width: "100%", minHeight: 60 }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask the model about the image…"
            />
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Answer</div>
            <div className="chat-history" style={{ maxHeight: 260 }}>
              {turns.map((t, idx) => (
                <div key={idx} className="chat-bubble bot">
                  <div className="bubble">
                    <strong style={{ display: "block", marginBottom: 4 }}>
                      Prompt: {t.prompt}
                    </strong>
                    <div>{t.response || (idx === turns.length - 1 && isStreaming ? "…" : "")}</div>
                  </div>
                </div>
              ))}
              {turns.length === 0 && (
                <div className="chat-bubble bot">
                  <div className="bubble">
                    Upload an image, write a prompt, and click <strong>Analyze image</strong> to
                    see the model's description here.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
