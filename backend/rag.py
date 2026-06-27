from pathlib import Path

from dotenv import load_dotenv
load_dotenv()
import os

from pinecone import Pinecone, ServerlessSpec
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
import docx2txt


_embeddings = None
_index = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = GoogleGenerativeAIEmbeddings(model="gemini-embedding-001")
    return _embeddings


def get_index():
    global _index
    if _index is not None:
        return _index
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise RuntimeError("PINECONE_API_KEY not set. RAG features unavailable.")
    pc = Pinecone(api_key=api_key)
    index_name = "axiogpt-docs"
    existing_indexes = [i.name for i in pc.list_indexes()]
    if index_name not in existing_indexes:
        pc.create_index(
            name=index_name,
            dimension=768,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
    _index = pc.Index(index_name)
    return _index


SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".txt", ".md", ".py", ".csv",
    ".html", ".json", ".xml", ".yaml", ".yml", ".ini",
    ".cfg", ".log", ".rst", ".tex",
}


def read_file_text(file_path: str) -> str:
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if suffix == ".docx":
        return docx2txt.process(file_path)

    if suffix in SUPPORTED_EXTENSIONS:
        return path.read_text(encoding="utf-8", errors="ignore")

    raise ValueError(f"Unsupported file type: {suffix}. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")


def add_document_to_rag(file_path: str, thread_id: str):
    text = read_file_text(file_path)
    if not text.strip():
        raise ValueError("No text could be extracted from this file.")

    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=150)
    chunks = splitter.split_text(text)

    vectors = []
    filename = Path(file_path).name
    embeddings = get_embeddings()
    index = get_index()
    for i, chunk in enumerate(chunks):
        vectors.append({
            "id": f"{thread_id}_{filename}_{i}",
            "values": embeddings.embed_query(chunk),
            "metadata": {
                "thread_id": thread_id,
                "source": filename,
                "chunk_index": i,
                "text": chunk,
            },
        })

    index.upsert(vectors)
    return {"filename": filename, "chunks": len(chunks)}


def retrieve_from_rag(query: str, thread_id: str = "", k: int = 4) -> str:
    try:
        embeddings = get_embeddings()
        index = get_index()
    except RuntimeError as e:
        return str(e)

    filter_args = {"thread_id": {"$eq": thread_id}} if thread_id else None
    results = index.query(
        vector=embeddings.embed_query(query),
        top_k=k,
        filter=filter_args,
        include_metadata=True,
    )

    matches = results.get("matches", [])
    if not matches:
        return "No relevant uploaded document content found."

    output = []
    for i, m in enumerate(matches, 1):
        source = m["metadata"].get("source", "uploaded document")
        text = m["metadata"].get("text", "")
        output.append(f"[Source {i}: {source}]\n{text}")

    return "\n\n".join(output)
