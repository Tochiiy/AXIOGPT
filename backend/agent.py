import os

from dotenv import load_dotenv
load_dotenv()

from database import checkpointer
from langchain_core.messages import SystemMessage

from langgraph.graph import StateGraph, MessagesState, START
from langgraph.prebuilt import ToolNode, tools_condition

from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openrouter import ChatOpenRouter
from langchain_cerebras import ChatCerebras
from langchain_nvidia_ai_endpoints import ChatNVIDIA

DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama-3.3-70b-versatile")
ALLOWED_MODELS = [
    "llama-3.3-70b-versatile",
    "gpt-oss-120b",
    "openrouter/auto",
    "nvidia/nemotron-3-super-120b-a12b",
    "models/gemini-2.5-flash",
]
SYSTEM_PROMPT = """
You are a helpful Agentic AI assistant named AxioGPT similar to ChatGPT.

You can:
1. Answer normal questions.
2. Use tools when needed.
3. Search uploaded documents using the RAG tool.
4. Search the web for latest/current information using Tavily Search.
5. Remember important user information using the memory tool.
6. Recall memory when useful.
7. Use calculator for math.

Rules:
- If the user asks about latest news, current events, recent updates, today's information, current price... use web search.
- For ANY question the user asks, ALWAYS start by using search_uploaded_documents to check if relevant information exists in uploaded files. Only fall back to your training data or web search if RAG returns no useful results.
- If using search_uploaded_documents returns no relevant results, then use web search or your own knowledge.
- If the user asks about a specific person, topic, or concept that might be in an uploaded document (like an assignment, resume, or PDF), search_uploaded_documents should be your first step.
- If the user asks you to remember something, use remember_this.
- If the user asks about previous preferences or saved facts, use recall_memory.
- Use calculator for math questions.
- When using web search, summarize clearly and mention that the answer is based on web search results.
- Be clear, helpful, and concise.
"""


def normalize_model_name(model: str | None) -> str:
    """
    validate and normalize model from the frontend
    if model is None, return DEFAULT_MODEL
    """
    if not model or model not in ALLOWED_MODELS:
        return DEFAULT_MODEL
    return model


MODEL_PROVIDER_MAP = {
    "llama-3.3-70b-versatile": "groq",
    "gpt-oss-120b": "cerebras",
    "openrouter/auto": "openrouter",
    "nvidia/nemotron-3-super-120b-a12b": "nvidia",
}

_AGENT_CACHE: dict = {}

from tools import tools


def get_agent(model: str | None = None):
    model = normalize_model_name(model or DEFAULT_MODEL)
    if model in _AGENT_CACHE:
        return _AGENT_CACHE[model]

    kwargs = dict(model=model, temperature=0.3, streaming=True)
    provider = MODEL_PROVIDER_MAP.get(model)
    if provider == "groq":
        llm = ChatGroq(**kwargs)
    elif provider == "cerebras":
        llm = ChatCerebras(**kwargs)
    elif provider == "openrouter":
        llm = ChatOpenRouter(**kwargs)
    elif provider == "nvidia":
        llm = ChatNVIDIA(**kwargs)
    else:
        llm = ChatGoogleGenerativeAI(**kwargs)

    llm_with_tools = llm.bind_tools(tools)

    def chatbot_node(state: MessagesState):
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
        ] + state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    tool_node = ToolNode(tools)
    workflow = StateGraph(MessagesState)
    workflow.add_node("chatbot", chatbot_node)
    workflow.add_node("tools", tool_node)
    workflow.add_edge(START, "chatbot")
    workflow.add_conditional_edges("chatbot", tools_condition)
    workflow.add_edge("tools", "chatbot")

    agent = workflow.compile(checkpointer=checkpointer)
    _AGENT_CACHE[model] = agent
    return agent


graph = get_agent()