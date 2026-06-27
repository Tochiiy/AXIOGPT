const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const { headers: extraHeaders, body, ...rest } = options;
  const isFormData = body instanceof FormData;
  const headers = isFormData
    ? { ...extraHeaders }
    : { "Content-Type": "application/json", ...extraHeaders };

  const res = await fetch(`${BASE_URL}${path}`, { headers, body, ...rest });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`[${res.status}] ${path} — ${text}`);
  }

  return res;
}

export async function getModels() {
  const res = await request("/models");
  const data = await res.json();
  return { list: data.models, defaultModel: data.default };
}

export async function getConversations() {
  const res = await request("/conversations");
  return res.json();
}

export async function getHistory(threadId) {
  if (!threadId) throw new Error("threadId is required");
  const res = await request(`/history/${threadId}`);
  return res.json();
}

export async function uploadFile(file, threadId) {
  const form = new FormData();
  form.append("file", file);
  if (threadId) form.append("thread_id", threadId);

  const res = await request("/upload", {
    method: "POST",
    body: form,
  });

  return res.json();
}

export async function streamChat({ message, threadId, model }) {
  const res = await request("/chat/stream", {
    method: "POST",
    body: JSON.stringify({
      message,
      thread_id: threadId ?? null,
      model: model ?? null,
    }),
  });

  return res;
}
