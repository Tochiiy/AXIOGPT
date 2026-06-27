import os
import re
import pathlib
from datetime import datetime, timezone
import requests
import numexpr
import wikipediaapi
import fitz
from langchain_core.tools import tool
from tavily import TavilyClient
from youtube_transcript_api import YouTubeTranscriptApi
from google.genai import Client as GenaiClient
import trafilatura

import yfinance as yf
from database import save_memory, search_memory
from rag import add_document_to_rag, retrieve_from_rag

tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
wiki = wikipediaapi.Wikipedia("AxioGPT/1.0", extract_format=wikipediaapi.ExtractFormat.WIKI)

CURRENT_THREAD_ID = "default"


def set_current_thread_id(thread_id: str):
    global CURRENT_THREAD_ID
    CURRENT_THREAD_ID = thread_id


@tool
def search_web(query: str) -> str:
    """Search the web using Tavily for latest/current information."""
    try:
        results = tavily_client.search(query, max_results=5)
        return "\n\n".join(
            f"{r['title']}\n{r['content']}\n{r['url']}"
            for r in results.get("results", [])
        )
    except Exception as e:
        return f"Search failed: {e}"


@tool
def calculate(expression: str) -> str:
    """Evaluate a mathematical expression safely."""
    try:
        result = numexpr.evaluate(expression)
        return str(result)
    except Exception as e:
        return f"Calculation error: {e}"


@tool
def get_current_time() -> str:
    """Get the current date and time in a readable format."""
    now = datetime.now(timezone.utc)
    return now.strftime("%A, %B %d, %Y at %I:%M:%S %p UTC")


@tool
def get_stock_price(ticker: str) -> str:
    """Get current stock price and info for a ticker symbol (e.g. AAPL, TSLA, GOOGL)."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        price = info.get("currentPrice") or info.get("regularMarketPrice", "N/A")
        change = info.get("regularMarketChangePercent", "N/A")
        high = info.get("regularMarketDayHigh", "N/A")
        low = info.get("regularMarketDayLow", "N/A")
        name = info.get("shortName", ticker.upper())
        return (
            f"{name} ({ticker.upper()})\n"
            f"Price: ${price}\n"
            f"Change: {change:.2f}%\n"
            f"Day Range: ${low} - ${high}"
        )
    except Exception as e:
        return f"Stock price lookup failed: {e}"


@tool
def get_weather(location: str) -> str:
    """Get current weather for a location using OpenWeather."""
    try:
        key = os.getenv("OPENWEATHER_API_KEY")
        if not key:
            return "OpenWeather API key not set."
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": location, "appid": key, "units": "metric"},
            timeout=10,
        )
        data = resp.json()
        if resp.status_code != 200:
            return f"Weather error: {data.get('message', 'unknown')}"
        w = data["main"]
        wind = data["wind"]["speed"]
        desc = data["weather"][0]["description"]
        return (
            f"Weather in {data['name']}, {data['sys'].get('country', '')}: "
            f"{desc}, {w['temp']}°C (feels like {w['feels_like']}°C), "
            f"humidity {w['humidity']}%, wind {wind} m/s"
        )
    except Exception as e:
        return f"Weather fetch failed: {e}"


@tool
def get_location() -> str:
    """Get the user's approximate location based on IP address."""
    try:
        resp = requests.get("https://ipapi.co/json/", timeout=10)
        data = resp.json()
        return (
            f"IP: {data.get('ip')}, City: {data.get('city')}, "
            f"Region: {data.get('region')}, Country: {data.get('country_name')}, "
            f"Lat/Lon: {data.get('latitude')}, {data.get('longitude')}"
        )
    except Exception as e:
        return f"Location lookup failed: {e}"


@tool
def research_wikipedia(topic: str) -> str:
    """Search and summarize a topic from Wikipedia."""
    try:
        page = wiki.page(topic)
        if not page.exists():
            return f"No Wikipedia page found for '{topic}'."
        summary = page.summary[:2000]
        return f"{page.title}\n\n{summary}\n\nSource: {page.fullurl}"
    except Exception as e:
        return f"Wikipedia lookup failed: {e}"


genai_client = None
if os.getenv("GEMINI_API_KEY"):
    genai_client = GenaiClient(api_key=os.getenv("GEMINI_API_KEY"))


@tool
def generate_image(prompt: str) -> str:
    """Generate an image from a text description using Pollinations.ai."""
    try:
        filename = prompt[:30].strip().replace(" ", "_") + ".png"
        path = f"generated_images/{filename}"
        os.makedirs("generated_images", exist_ok=True)
        resp = requests.get(
            "https://image.pollinations.ai/prompt/" + requests.utils.quote(prompt),
            timeout=30,
        )
        with open(path, "wb") as f:
            f.write(resp.content)
        return f"Image saved to {path}"
    except Exception as e:
        return f"Image generation failed: {e}"


@tool
def get_youtube_transcript(video_url: str) -> str:
    """Get the transcript of a YouTube video."""
    try:
        match = re.search(r"(?:v=|youtu\.be/|shorts/)([\w-]{11})", video_url)
        if not match:
            match = re.search(r"^([\w-]{11})$", video_url.strip())
        if not match:
            return "Could not extract video ID from URL."
        vid = match.group(1)
        transcript = YouTubeTranscriptApi.get_transcript(vid)
        text = " ".join(seg["text"] for seg in transcript)
        return text[:5000]
    except Exception as e:
        return f"Transcript fetch failed: {e}"


@tool
def analyze_image(image_url: str, prompt: str = "Describe this image in detail") -> str:
    """Analyze an image using Gemini Vision. Provide image URL and an optional prompt."""
    if not genai_client:
        return "Image analysis not available (GEMINI_API_KEY missing)."
    try:
        import httpx
        image = httpx.get(image_url, timeout=15)
        image.raise_for_status()
        from google.genai.types import Part, Content
        response = genai_client.models.generate_content(
            model="models/gemini-2.5-flash",
            contents=[prompt, Part(inline_data={"mime_type": "image/jpeg", "data": image.content})],
        )
        return response.text[:3000]
    except Exception as e:
        return f"Image analysis failed: {e}"


@tool
def crawl_webpage(url: str) -> str:
    """Extract and summarize the main text content from a webpage."""
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return f"Failed to fetch {url}"
        text = trafilatura.extract(downloaded, output_format="txt", include_comments=False)
        if not text:
            return "No readable content found."
        return text[:5000]
    except Exception as e:
        return f"Crawl failed: {e}"


WORK_DIR = pathlib.Path.cwd()


@tool
def read_directory(path: str = ".") -> str:
    """List files and directories at the given path (relative to project root)."""
    try:
        target = (WORK_DIR / path).resolve()
        if not str(target).startswith(str(WORK_DIR)):
            return "Access denied: path outside workspace."
        entries = []
        for entry in sorted(target.iterdir()):
            label = "[DIR]" if entry.is_dir() else "[FILE]"
            entries.append(f"{label} {entry.name}")
        return "\n".join(entries) if entries else "Empty directory."
    except Exception as e:
        return f"Directory read failed: {e}"


@tool
def read_file(path: str) -> str:
    """Read the contents of a text file (relative to project root)."""
    try:
        target = (WORK_DIR / path).resolve()
        if not str(target).startswith(str(WORK_DIR)):
            return "Access denied: path outside workspace."
        return target.read_text(encoding="utf-8")[:10000]
    except Exception as e:
        return f"File read failed: {e}"


@tool
def write_file(path: str, content: str) -> str:
    """Write content to a file (relative to project root). Creates directories if needed."""
    try:
        target = (WORK_DIR / path).resolve()
        if not str(target).startswith(str(WORK_DIR)):
            return "Access denied: path outside workspace."
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Written to {path}"
    except Exception as e:
        return f"File write failed: {e}"


@tool
def read_pdf(path: str) -> str:
    """Extract text from a PDF file (relative to project root)."""
    try:
        target = (WORK_DIR / path).resolve()
        if not str(target).startswith(str(WORK_DIR)):
            return "Access denied: path outside workspace."
        doc = fitz.open(target)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text[:10000]
    except Exception as e:
        return f"PDF read failed: {e}"


@tool
def remember_this(memory: str) -> str:
    """Remember important user information."""
    return save_memory(thread_id=CURRENT_THREAD_ID, memory=memory)


@tool
def recall_memory(query: str) -> str:
    """Recall previously saved memories for this session."""
    return search_memory(thread_id=CURRENT_THREAD_ID, query=query)


@tool
def upload_document(file_path: str, thread_id: str = "") -> str:
    """Upload and index a document for RAG. Supports PDF, DOCX, TXT, MD, PY, CSV, HTML, JSON, and more."""
    try:
        result = add_document_to_rag(file_path, thread_id or CURRENT_THREAD_ID)
        return f"Uploaded '{result['filename']}' — {result['chunks']} chunks indexed."
    except Exception as e:
        return f"Upload failed: {e}"


@tool
def search_uploaded_documents(query: str, thread_id: str = "") -> str:
    """Search uploaded documents using RAG. Use when the user asks about an uploaded file or document."""
    try:
        return retrieve_from_rag(query)
    except Exception as e:
        return f"RAG search failed: {e}"

tools = [
    search_web,
    calculate,
    get_current_time,
    get_stock_price,
    get_weather,
    get_location,
    research_wikipedia,
    get_youtube_transcript,
    analyze_image,
    crawl_webpage,
    read_directory,
    read_file,
    write_file,
    read_pdf,
    remember_this,
    recall_memory,
    generate_image,
    upload_document,
    search_uploaded_documents,
]
