
import os
import io
import json
import time
import shutil
import threading
from datetime import date
from typing import List, Optional, AsyncGenerator

import fitz  # PyMuPDF
import ollama
import requests
from fastapi import FastAPI, UploadFile, File, Form, Response
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Utilities migrated from your existing project
from utilities.ollama_utils import extract_model_names
from utilities.power_usage import (
    get_cpu_power_usage, get_gpu_power_usage, get_power_usage_history, get_default_power_usages
)
from utilities.date_time import get_datetime

# -----------------------------
# Global state mirroring Gradio
# -----------------------------
CHAT_DIR = "chats"
IMG_DIR = "images"
REPORTS_DIR = "reports"
os.makedirs(CHAT_DIR, exist_ok=True)
os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

# Power tracking (ported from Gradio_home.py)
_llm_running_flag = {"mode": "None"}           # "Chat" | "Image" | "None"
_normal_consumption = 0.0
_decay = 0.5
_latest_prompt_Wh = 0.0
_session_total_Wh = 0.0
_calculated_accumulator = 0.0
_update_period = 0.2  # seconds
_latest_image_meta = {"date": None, "model": None}
_latest_chat_model = None
_power_thread_started = False
_power_thread_lock = threading.Lock()

def _ensure_power_thread():
    global _power_thread_started
    if _power_thread_started:
        return
    _power_thread_started = True

    def _runner():
        global _normal_consumption, _calculated_accumulator, _latest_prompt_Wh, _session_total_Wh
        df_default = get_default_power_usages()
        while True:
            try:
                cpu = get_cpu_power_usage()
                gpu, _ = get_gpu_power_usage()
                gpu = gpu or 0.0

                if _llm_running_flag["mode"] in ("Chat", "Image"):
                    _calculated_accumulator += (gpu - _normal_consumption) * _update_period
                else:
                    if _calculated_accumulator > 0:
                        _latest_prompt_Wh = _calculated_accumulator / 3600.0
                        _session_total_Wh += _latest_prompt_Wh
                        # Persist to reports
                        entry = {
                            "date": get_datetime(),
                            "power": _latest_prompt_Wh,
                            "model": f"{_latest_chat_model}" if _llm_running_flag["mode"] == "Chat"
                                     else f"{_latest_image_meta.get('model')}(image_analysis)"
                        }
                        path = os.path.join(REPORTS_DIR, "power_consumption_reports.json")
                        if os.path.exists(path) and os.path.getsize(path) > 0:
                            with open(path, "r") as f:
                                try:
                                    data = json.load(f)
                                except json.JSONDecodeError:
                                    data = []
                        else:
                            data = []
                        data.append(entry)
                        with open(path, "w") as f:
                            json.dump(data, f, indent=2)
                        _calculated_accumulator = 0.0
                        _llm_running_flag["mode"] = "None"

                    _normal_consumption = _normal_consumption * _decay + gpu * (1 - _decay)
            except Exception:
                pass
            time.sleep(_update_period)

    t = threading.Thread(target=_runner, daemon=True)
    t.start()


app = FastAPI(title="React <> Python API (Ollama)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------- Helpers -------------
def _extract_text_from_pdf(path: str) -> str:
    try:
        text = ""
        pdf = fitz.open(path)
        for i in range(len(pdf)):
            text += pdf[i].get_text()
        pdf.close()
        return text
    except Exception:
        return ""

def _extract_text_from_txt(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""

def _aggregate_context_from_files(files: List[str]) -> str:
    if not files:
        return ""
    out = "I'm providing you with the following documents for context:\n\n"
    for f in files:
        base = os.path.basename(f)
        content = ""
        if base.lower().endswith(".pdf"):
            content = _extract_text_from_pdf(f)
        elif base.lower().endswith(".txt"):
            content = _extract_text_from_txt(f)
        if content:
            out += f"--- Document: {base} ---\n{content}\n\n"
    return out

# ------------- Models -------------
@app.get("/api/models")
def list_models():
    return {"models": list(extract_model_names().keys())}

@app.post("/api/models/pull")
def pull_model(name: str = Form(...)):
    try:
        ollama.pull(name)
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

@app.delete("/api/models")
def delete_models(models: List[str]):
    results = {}
    for m in models:
        try:
            ollama.delete(m)
            results[m] = "deleted"
        except Exception as e:
            results[m] = f"error: {e}"
    return {"results": results}

@app.post("/api/models/create")
def create_model(name: str = Form(...), modelfile: str = Form(...)):
    try:
        ollama.create(model=name, modelfile=modelfile)
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

# ------------- Chat (streaming) -------------
@app.post("/api/chat")
def chat(prompt: str = Form(...),
         model: str = Form(...),
         files: Optional[List[UploadFile]] = File(None)) -> StreamingResponse:
    """
    Streams text chunks as Server-Sent Events (text/event-stream).
    """
    # Build messages
    context_files = []
    if files:
        tmpdir = os.path.join(CHAT_DIR, "_tmp")
        os.makedirs(tmpdir, exist_ok=True)
        for f in files:
            dst = os.path.join(tmpdir, f.filename)
            with open(dst, "wb") as out:
                shutil.copyfileobj(f.file, out)
            context_files.append(dst)

    system_ctx = _aggregate_context_from_files(context_files)
    messages = []
    if system_ctx:
        messages.append({"role": "system", "content": system_ctx})
    messages.append({"role": "user", "content": prompt})

    def _gen() -> AsyncGenerator[bytes, None]:
        global _latest_chat_model
        _ensure_power_thread()
        _llm_running_flag["mode"] = "Chat"
        _latest_chat_model = model
        try:
            stream = ollama.chat(model=model, messages=messages, stream=True)
            for chunk in stream:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield f"data: {json.dumps({'delta': content})}\n\n".encode("utf-8")
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n".encode("utf-8")
        finally:
            # Turn flag off; power thread will compute Wh and persist
            _llm_running_flag["mode"] = "None"
            yield b"data: {\"done\": true}\n\n"

    return StreamingResponse(_gen(), media_type="text/event-stream")

# ------------- Image analysis (streaming) -------------
@app.post("/api/image/analyze")
def analyze_image(prompt: str = Form(...),
                  model: str = Form(...),
                  image: UploadFile = File(...)) -> StreamingResponse:
    # Persist image temporarily
    os.makedirs(IMG_DIR, exist_ok=True)
    path = os.path.join(IMG_DIR, "_tmp_image.png")
    with open(path, "wb") as out:
        shutil.copyfileobj(image.file, out)

    # Prepare base64
    import base64
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    def _gen():
        _ensure_power_thread()
        _llm_running_flag["mode"] = "Image"
        _latest_image_meta.update({"date": get_datetime(), "model": model})
        try:
            # Using Ollama HTTP endpoint for multi-modal just like Gradio_image_analysis.py
            r = requests.post(
                "http://localhost:11434/api/generate",
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                json={"model": model, "prompt": prompt, "images": [b64], "stream": True},
                stream=True,
                timeout=60,
            )
            r.raise_for_status()
            for line in r.iter_lines():
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                    if "response" in payload:
                        yield f"data: {json.dumps({'delta': payload['response']})}\n\n".encode("utf-8")
                except json.JSONDecodeError:
                    continue
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n".encode("utf-8")
        finally:
            _llm_running_flag["mode"] = "None"
            yield b"data: {\"done\": true}\n\n"

    return StreamingResponse(_gen(), media_type="text/event-stream")

# ------------- Save / Load chat -------------
@app.get("/api/chats")
def list_chats():
    items = [d for d in os.listdir(CHAT_DIR) if os.path.isdir(os.path.join(CHAT_DIR, d))]
    return {"chats": items}

@app.post("/api/chats/save")
def save_chat(
    name: str = Form(...),
    history_json: str = Form(...),
    # NEW (optional) fields:
    metrics_json: str | None = Form(None),   # per-prompt words/chars and timestamps
    session_json: str | None = Form(None),   # participantId, group, session, timer, energy totals
    interview_text: str | None = Form(None), # optional qualitative notes
):
    path = os.path.join(CHAT_DIR, name)
    os.makedirs(path, exist_ok=True)

    with open(os.path.join(path, "history.json"), "w", encoding="utf-8") as f:
        f.write(history_json)

    if metrics_json:
        with open(os.path.join(path, "metrics.json"), "w", encoding="utf-8") as f:
            f.write(metrics_json)

    if session_json:
        with open(os.path.join(path, "session.json"), "w", encoding="utf-8") as f:
            f.write(session_json)

    if interview_text:
        with open(os.path.join(path, "interview.txt"), "w", encoding="utf-8") as f:
            f.write(interview_text)

    return {"ok": True}

@app.get("/api/chats/{name}")
def load_chat_endpoint(name: str):
    path = os.path.join(CHAT_DIR, name, "history.json")
    if not os.path.exists(path):
        return JSONResponse({"error": "not found"}, status_code=404)
    with open(path, "r") as f:
        return JSONResponse(json.load(f))

# ------------- Save / Load image analyses -------------
@app.get("/api/analyses")
def list_analyses():
    items = [d for d in os.listdir(IMG_DIR) if os.path.isdir(os.path.join(IMG_DIR, d))]
    return {"analyses": items}

@app.post("/api/analyses/save")
def save_analysis(name: str = Form(...), history_json: str = Form(...), image: UploadFile = File(None)):
    path = os.path.join(IMG_DIR, name)
    os.makedirs(path, exist_ok=True)
    with open(os.path.join(path, "history.json"), "w") as f:
        f.write(history_json)
    if image:
        with open(os.path.join(path, "image.png"), "wb") as out:
            shutil.copyfileobj(image.file, out)
    return {"ok": True}

@app.get("/api/analyses/{name}")
def load_analysis_endpoint(name: str):
    path = os.path.join(IMG_DIR, name, "history.json")
    if not os.path.exists(path):
        return JSONResponse({"error": "not found"}, status_code=404)
    with open(path, "r") as f:
        payload = json.load(f)
    img_path = os.path.join(IMG_DIR, name, "image.png")
    img_exists = os.path.exists(img_path)
    return {"history": payload, "has_image": img_exists}

# ------------- Power endpoints -------------
@app.get("/api/power/summary")
def power_summary():
    path = os.path.join(REPORTS_DIR, "power_consumption_reports.json")
    df = get_power_usage_history(path)
    today_total = 0.0
    if not df.empty:
        today = date.today()
        today_rows = df[df["date"].dt.date == today]
        today_total = float(today_rows["power"].sum())
    return {
        "latest_prompt_Wh": _latest_prompt_Wh,
        "session_total_Wh": _session_total_Wh,
        "today_total_Wh": today_total,
    }

@app.get("/api/power/stream")
def power_stream():
    def _gen():
        _ensure_power_thread()
        while True:
            try:
                summary = power_summary()
                yield f"data: {json.dumps(summary)}\n\n".encode("utf-8")
                time.sleep(1.0)
            except Exception:
                break
    return StreamingResponse(_gen(), media_type="text/event-stream")

@app.get("/api/analytics/power")
def analytics_power():
    local_path = os.path.join(REPORTS_DIR, "power_consumption_reports.json")
    df_local = get_power_usage_history(local_path)
    df_default = get_default_power_usages()
    local = []
    if not df_local.empty:
        local = df_local.to_dict(orient="records")
    default = []
    if df_default is not None and not df_default.empty:
        default = df_default.to_dict(orient="records")
    return {"local": local, "default": default}

# Health
@app.get("/api/health")
def health():
    return {"ok": True}
