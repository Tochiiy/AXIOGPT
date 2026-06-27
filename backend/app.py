import os
import io
import json
import uuid
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, Header, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from langchain_core.messages import HumanMessage, AIMessage, AIMessageChunk, ToolMessage

from agent import get_agent, ALLOWED_MODELS, DEFAULT_MODEL
from database import init_db, save_chat_message, get_chat_history, create_or_update_conversation, list_conversations, save_file_to_gridfs, get_file_from_gridfs
from rag import add_document_to_rag
from tools import set_current_thread_id

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AxioGPT")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS.split(",") if ALLOWED_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def should_stream(chunk, metadata) -> bool:
    metadata = metadata or {}
    if "tool" in str(metadata.get("langgraph_node", "")).lower():
        return False
    if isinstance(chunk, ToolMessage):
        return False
    if not isinstance(chunk, (AIMessage, AIMessageChunk)):
        return False
    if getattr(chunk, "tool_calls", None) or getattr(chunk, "invalid_tool_calls", None):
        return False
    if (getattr(chunk, "additional_kwargs", {}) or {}).get("tool_calls"):
        return False
    return True


def extract(chunk) -> str:
    c = getattr(chunk, "content", "")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts = []
        for item in c:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                for k in ("text", "content"):
                    v = item.get(k)
                    if isinstance(v, str):
                        parts.append(v)
                        break
        return "".join(parts)
    return ""


@app.get("/")
async def root():
    return {"status": "ok", "app": "AxioGPT"}


@app.get("/health")
async def health():
    return {"status": "healthy", "app": "AxioGPT"}


@app.get("/models")
async def models():
    return {"models": ALLOWED_MODELS, "default": DEFAULT_MODEL}


@app.get("/conversations")
async def conversations(x_user_id: str = Header("")):
    items = list_conversations(x_user_id) if x_user_id else []
    return {
        "conversations": [
            {
                "thread_id": c["thread_id"],
                "title": c["title"],
                "created_at": c["created_at"].isoformat(),
                "updated_at": c["updated_at"].isoformat(),
            }
            for c in items
        ]
    }


@app.get("/history/{thread_id}")
async def history(thread_id: str):
    msgs = get_chat_history(thread_id)
    return {"messages": [{"role": m["role"], "content": m["content"]} for m in msgs]}


@app.post("/upload")
@limiter.limit("20/minute")
async def upload(request: Request, file: UploadFile = File(...), thread_id: str = Form("default")):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".pdf", ".docx", ".txt", ".md", ".py", ".csv"}:
        return JSONResponse({"success": False, "message": "Unsupported file type."}, status_code=400)
    data = await file.read()
    grid_id = save_file_to_gridfs(file.filename or "file", data, file.content_type or "")
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        r = add_document_to_rag(tmp_path, thread_id)
        return {"success": True, "file_id": grid_id, "message": f"Uploaded {r['filename']} ({r['chunks']} chunks)."}
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)
    finally:
        os.unlink(tmp_path)


@app.get("/files/{file_id}")
async def download_file(file_id: str):
    result = get_file_from_gridfs(file_id)
    if result is None:
        return JSONResponse({"error": "File not found."}, status_code=404)
    data, filename = result
    return StreamingResponse(io.BytesIO(data), media_type="application/octet-stream", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, body: dict, x_user_id: str = Header("")):
    try:
        msg = body.get("message", "").strip()
        tid = body.get("thread_id") or str(uuid.uuid4())
        is_new = not body.get("thread_id")
        model = body.get("model", DEFAULT_MODEL)
        if not msg:
            return JSONResponse({"error": "Message is required."}, status_code=400)

        agent = get_agent(model)
        create_or_update_conversation(tid, x_user_id, msg)
        save_chat_message(tid, x_user_id, "user", msg)
        set_current_thread_id(tid)
        config = {"configurable": {"thread_id": tid}}

        def gen():
            nonlocal is_new
            reply = ""
            tool_active = False
            if is_new:
                yield f"data: [THREAD:{tid}]\n\n"
                is_new = False
            try:
                for chunk, meta in agent.stream({"messages": [HumanMessage(content=msg)]}, config=config, stream_mode="messages"):
                    node = (meta or {}).get("langgraph_node", "")
                    if node == "tools" and not tool_active:
                        tool_active = True
                        yield "data: [TOOL:Thinking...]\n\n"
                    elif node != "tools":
                        tool_active = False

                    if not should_stream(chunk, meta):
                        continue
                    token = extract(chunk)
                    if token:
                        reply += token
                        yield sse({"token": token})
                if reply.strip():
                    save_chat_message(tid, x_user_id, "assistant", reply)
                yield sse({"done": True})
            except Exception as e:
                yield sse({"error": str(e)})
                yield sse({"done": True})

        return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
