import { useState } from "react";
import { useChat } from "../../context/ChatContext";

function modelLabel(m) {
  if (m.includes("gemini-2.5-flash")) return "Gemini 2.5 Flash";
  if (m.includes("llama-3.3-70b")) return "Llama 3.3 70B";
  if (m.includes("gpt-oss")) return "GPT OSS 120B";
  if (m.includes("openrouter/auto")) return "OpenRouter Auto";
  if (m.includes("nemotron")) return "Nemotron 120B";
  return m;
}

function groupByDate(conversations) {
  const today = new Date();
  const groups = { Today: [], Yesterday: [], "This week": [], Older: [] };
  for (const c of conversations) {
    const d = new Date(c.created_at);
    const diff = Math.floor((today - d) / 86400000);
    if (diff < 1) groups["Today"].push(c);
    else if (diff < 2) groups["Yesterday"].push(c);
    else if (diff < 7) groups["This week"].push(c);
    else groups["Older"].push(c);
  }
  return groups;
}

export default function Sidebar({ open, onClose }) {
  const { state, dispatch, selectConversation } = useChat();
  const [search, setSearch] = useState("");

  const filtered = state.conversations.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase()),
  );
  const groups = groupByDate(filtered);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
        fixed md:static inset-y-0 left-0 z-30
        flex flex-col w-64 h-full
        bg-[#171717] border-r border-white/[0.07]
        transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        {/* header */}
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-lg bg-[#c96442] flex items-center justify-center shrink-0">
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 2v7M6.5 5.5L10 2l3.5 3.5M4 13h12M7 17h6" />
              </svg>
            </div>
            <span className="font-semibold text-[15px] text-white tracking-tight">
              AxioGPT
            </span>
          </div>
          <button
            onClick={() => {
              dispatch({ type: "NEW_CHAT" });
              onClose?.();
            }}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            title="New chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>

        {/* search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/[0.07]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 text-white/30 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search chats"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-[13px] text-white/70 placeholder:text-white/25 w-full"
            />
          </div>
        </div>

        {/* conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {state.loadingConversations ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-sm text-white/20"></span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-white/20 text-xs mt-10">
              {search ? "No results" : "No conversations yet"}
            </p>
          ) : (
            Object.entries(groups).map(([label, items]) =>
              items.length === 0 ? null : (
                <div key={label}>
                  <p className="text-[10px] font-medium text-white/25 uppercase tracking-widest px-2 pt-4 pb-1">
                    {label}
                  </p>
                  {items.map((c) => (
                    <button
                      key={c.thread_id}
                      onClick={() => {
                        selectConversation(c.thread_id);
                        onClose?.();
                      }}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left
                        text-[13px] transition-colors duration-100
                        ${
                          state.activeThreadId === c.thread_id
                            ? "bg-white/10 text-white"
                            : "text-white/50 hover:bg-white/5 hover:text-white/80"
                        }
                      `}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3.5 h-3.5 shrink-0 opacity-40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span className="truncate flex-1">
                        {c.title || "New conversation"}
                      </span>
                    </button>
                  ))}
                </div>
              ),
            )
          )}
        </div>

        {/* footer */}
        <div className="border-t border-white/[0.07] px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#c96442] flex items-center justify-center text-white text-xs font-semibold shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/80 font-medium truncate">
                AxioGPT
              </p>
              <p className="text-[11px] text-white/30 truncate">
                {modelLabel(state.activeModel)}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
