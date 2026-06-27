import os
from typing import Optional
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()
from pymongo import MongoClient
from pymongo.database import Database
from langgraph.checkpoint.mongodb import MongoDBSaver


client: Optional[MongoClient] = None
db: Optional[Database] = None
checkpointer = None


def init_db():
    global client, db, checkpointer
    uri = os.getenv("MONGO_DB_URI")
    if not uri:
        return
    client = MongoClient(uri)
    db = client.get_database("axiogpt")
    checkpointer = MongoDBSaver(client)

    db["conversations"].create_index("thread_id", unique=True)
    db["chat_messages"].create_index("thread_id")
    db["long_term_memory"].create_index("thread_id")


def create_or_update_conversation(thread_id: str, first_message: str | None = None):
    conversation = db["conversations"].find_one({"thread_id": thread_id})

    if not conversation:
        title = "New Chat"
        if first_message:
            title = first_message.strip()[:40]
            if len(first_message.strip()) > 40:
                title += "..."

        db["conversations"].insert_one({
            "thread_id": thread_id,
            "title": title,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
    else:
        db["conversations"].update_one(
            {"thread_id": thread_id},
            {"$set": {"updated_at": datetime.now(timezone.utc)}}
        )


def list_conversations():
    return list(
        db["conversations"]
        .find()
        .sort("updated_at", -1)
    )


def save_chat_message(thread_id: str, role: str, content: str):
    db["chat_messages"].insert_one({
        "thread_id": thread_id,
        "role": role,
        "content": content,
        "created_at": datetime.now(timezone.utc),
    })

    db["conversations"].update_one(
        {"thread_id": thread_id},
        {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )


def get_chat_history(thread_id: str):
    return list(
        db["chat_messages"]
        .find({"thread_id": thread_id})
        .sort("created_at", 1)
    )


def save_memory(thread_id: str, memory: str):
    db["long_term_memory"].insert_one({
        "thread_id": thread_id,
        "memory": memory,
        "created_at": datetime.now(timezone.utc),
    })

    return "Memory saved successfully."


def search_memory(thread_id: str, query: str):
    memories = list(
        db["long_term_memory"]
        .find({"thread_id": thread_id})
        .sort("created_at", -1)
        .limit(20)
    )

    if not memories:
        return "No saved memory found."

    return "\n".join([f"- {m['memory']}" for m in memories])
