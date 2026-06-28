# AxioGPT
**Live:** [https://axioai.vercel.app](https://axioai.vercel.app)

Agentic AI assistant with web search, RAG over uploaded documents, memory, multi-model support, image generation, stock prices, weather, YouTube transcripts, Wikipedia, and more. Built on LangGraph, FastAPI, and React.

## Architecture

```
Frontend (React + Vite + DaisyUI)  →  Backend (FastAPI + LangGraph)  →  LLM Providers
                                        ↕                              ↕
                                    MongoDB ←→ Pinecone           Groq, Cerebras,
                                    (chat history,    (vector     OpenRouter, NVIDIA,
                                     files, memory)    search)    Gemini
```

## What makes this different

**LangGraph agent loop** — the model decides when to call tools, gets results, and continues the conversation. It's not a chatbot, it's an agent with 19 tools.

## Features

| Feature | How |
|---------|-----|
| **Multi-model** | Switch between 5 LLMs via dropdown |
| **Web search** | Tavily API for live information |
| **RAG** | Upload PDF/DOCX/TXT → Pinecone vector search |
| **Image generation** | Pollinations.ai (free, no API key) |
| **Image analysis** | Gemini Vision via URL |
| **Speech I/O** | Web Speech API (mic input) + TTS (read aloud) |
| **Memory** | Long-term memory across conversations |
| **YouTube transcripts** | Extract from any video URL |
| **Wikipedia** | Research any topic |
| **Stock prices** | yfinance data |
| **Weather** | OpenWeatherMap |
| **Location** | IP-based geolocation |
| **Calculator** | Safe expression evaluation |
| **File operations** | Read, write, list files on server |
| **File uploads** | Upload → GridFS (MongoDB) → index in RAG |
| **Dark theme** | DaisyUI dark mode |
| **Responsive** | Mobile sidebar, adaptive layout |
| **Quota handling** | Friendly messages on rate limits |

## Models

| Name | Provider | Why |
|------|----------|-----|
| Llama 3.3 70B | Groq | Fast, generous free tier |
| GPT OSS 120B | Cerebras | Fast, reliable |
| OpenRouter Auto | OpenRouter | Routes to best available |
| Nemotron 3 120B | NVIDIA | Optimized for tool-use |
| Gemini 2.5 Flash | Google | Free, vision, long context |

## Monitoring

| Service | What it tracks | Where to view |
|---------|---------------|---------------|
| **Sentry** | Backend + frontend errors, performance traces | https://sentry.io |
| **Google Analytics** | Page views, traffic, user behavior | https://analytics.google.com |
| **UptimeRobot** | Uptime monitoring + alerts | https://uptimerobot.com |
| **LangSmith** | LLM traces, agent step debugging | https://smith.langchain.com |

All on free tier. Sentry catches unhandled exceptions + slow transactions. LangSmith provides full trace visibility for every agent invocation.

## What I'd change if I started over

- **Pinecone or pgvector**: Pinecone is fine, but for self-hosted I'd use pgvector with Supabase.
- **MongoDB checkpointer**: LangGraph's `MongoDBSaver` adds latency on every streaming step. For production at scale, I'd use the Postgres checkpointer.
- **SSE vs WebSockets**: SSE is simpler and works through proxies. For bidirectional needs (mid-stream cancellation), WebSockets are cleaner.
- **File uploads to S3**: Currently saves to MongoDB GridFS. For multi-server scale, files would move to S3/Cloudinary.

## Local development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

Copy `.env` (not committed). Required vars:

```
GROQ_API_KEY=
CEREBRAS_API_KEY=
OPENROUTER_API_KEY=
NVIDIA_API_KEY=
GEMINI_API_KEY=
TAVILY_API_KEY=
PINECONE_API_KEY=
MONGO_DB_URI=
OPENWEATHER_API_KEY=
SENTRY_DSN=
LANGSMITH_API_KEY=           # optional, for LLM tracing
DEFAULT_MODEL=models/gemini-2.5-flash
ALLOWED_ORIGINS=http://localhost:5173
```

Start:

```bash
uvicorn app:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend env vars (set in `.env` or Vercel):

```
VITE_API_URL=http://localhost:8000
VITE_SENTRY_DSN=...
```

The Vite dev server proxies `/models`, `/conversations`, `/history`, `/upload`, `/chat` to the backend. Open `http://localhost:5173`.

### Docker

```bash
docker-compose up --build
```

Runs backend on `:8000` and frontend (nginx) on `:5173`.

## Deployment

### Backend → Render
- **URL:** https://axiogpt-backend.onrender.com
- Runtime: Docker, root dir: `backend`, auto-deploys from `main`
- Env: all backend vars including `SENTRY_DSN`

### Frontend → Vercel
- **URL:** https://axioai.vercel.app
- Root dir: `frontend`, env: `VITE_API_URL=...`, `VITE_SENTRY_DSN=...`

### CI/CD (GitHub Actions)
On push to `main`:
1. **Backend job** — installs Python deps, checks syntax, runs smoke test
2. **Frontend job** — installs npm deps, builds

### Isolation
Conversations are scoped per browser via a UUID in localStorage — no login required, but users can't see each other's chats.

**Why no JWT/auth?** Intentionally skipped for MVP speed. A UUID in localStorage is frictionless — users can start chatting immediately. When the app grows, JWT/auth can be added on top without changing the architecture (the `X-User-Id` header is already wired through).

### Persistence
- **Chat history** → MongoDB (`conversations`, `chat_messages`)
- **Uploaded files** → MongoDB GridFS
- **Long-term memory** → MongoDB (`long_term_memory`)
- **RAG vectors** → Pinecone index (`axiogpt-docs`)
- **Conversation state** → LangGraph MongoDBSaver checkpointer
- **LLM traces** → LangSmith (optional)

## API

All routes in `backend/app.py`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/health` | GET | Health check (for Render) |
| `/sentry-debug` | GET | Triggers test error for Sentry |
| `/models` | GET | List available models + default |
| `/conversations` | GET | List conversations (scoped by X-User-Id) |
| `/history/{thread_id}` | GET | Get messages for a thread |
| `/upload` | POST | Upload file (20/min) |
| `/files/{file_id}` | GET | Download uploaded file |
| `/chat/stream` | POST | Stream chat response via SSE (30/min) |

### `/chat/stream` request

```json
{
  "message": "search the web for AI news",
  "thread_id": null,
  "model": "llama-3.3-70b-versatile"
}
```

Leave `thread_id` null for new conversations. Server creates one and returns it as `data: [THREAD:uuid]\n\n`.

### SSE response format

```
data: {"token":"Hello"}
data: {"token":" world"}
data: [TOOL:Thinking...]
data: {"done":true}
```

Error format:

```
data: {"error":"Something went wrong"}
data: {"done":true}
```

## Project structure

```
├── backend/
│   ├── app.py              # FastAPI server, SSE streaming, routes, rate limits, Sentry
│   ├── agent.py            # LangGraph agent graph, 5 model providers, system prompt
│   ├── tools.py            # 19 tools (web search, calc, weather, stocks, RAG, memory, etc.)
│   ├── database.py         # MongoDB CRUD, GridFS files, LangGraph checkpointer
│   ├── rag.py              # Pinecone vector search, Gemini embeddings, file text extraction
│   ├── requirements.txt
│   ├── Dockerfile
│   └── Procfile
├── frontend/
│   ├── src/
│   │   ├── api/client.js                # 5 API functions + user ID management
│   │   ├── context/ChatContext.jsx       # Global state (useReducer), SSE reader loop
│   │   ├── components/
│   │   │   ├── InputBar/InputBar.jsx     # Text input, voice (Web Speech), drag-and-drop upload
│   │   │   ├── MessageBubble/MessageBubble.jsx  # Markdown renderer, code syntax highlight, copy/TTS/feedback
│   │   │   ├── Sidebar/Sidebar.jsx       # Conversation list grouped by date, search, model badge
│   │   │   ├── Topbar/Topbar.jsx         # Model selector dropdown, new chat button
│   │   │   ├── ChatWindow/ChatWindow.jsx # Message list auto-scroll, skeleton loader, tool activity toast
│   │   │   └── EmptyState/EmptyState.jsx # Welcome screen with 4 starter prompts
│   │   ├── App.jsx
│   │   ├── main.jsx          # Sentry init, React root
│   │   └── index.css         # Tailwind + DaisyUI + custom scrollbar/streaming cursor
│   ├── index.html            # GA4 gtag
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── .github/workflows/main.yml   # CI — Python check + frontend build
├── docker-compose.yml
├── vercel.json
└── .gitignore
```

## Tools (19 total)

Defined in `backend/tools.py`:

| Tool | Description |
|------|-------------|
| `search_web` | Tavily web search |
| `calculate` | Safe math evaluation (numexpr) |
| `get_current_time` | UTC date/time |
| `get_stock_price` | yfinance stock lookup |
| `get_weather` | OpenWeatherMap |
| `get_location` | IP-based geolocation |
| `research_wikipedia` | Wikipedia article summary |
| `generate_image` | Pollinations.ai (free) |
| `get_youtube_transcript` | YouTube video transcript |
| `analyze_image` | Gemini Vision (image URL + prompt) |
| `crawl_webpage` | Extract main text from URL (trafilatura) |
| `read_directory` | List files in a directory |
| `read_file` | Read text file |
| `write_file` | Write text file |
| `read_pdf` | Extract text from PDF (PyMuPDF) |
| `remember_this` | Save to long-term memory |
| `recall_memory` | Retrieve from long-term memory |
| `upload_document` | Upload + index file into RAG |
| `search_uploaded_documents` | RAG search across uploaded files |

## The agent loop

1. LLM gets system prompt + chat history
2. LLM returns response or tool calls (JSON function-calling)
3. LangGraph's `tools_condition` routes tool calls to `ToolNode`
4. ToolNode executes tools, feeds results back to LLM
5. Loops until LLM decides to respond directly
6. `MongoDBSaver` checkpointer saves state at every step for resume across restarts
