import { useChat } from "../../context/ChatContext";

function modelLabel(m) {
  if (m.includes("gemini-2.5-flash")) return "Gemini 2.5 Flash";
  if (m.includes("llama-3.3-70b")) return "Llama 3.3 70B";
  if (m.includes("gpt-oss")) return "GPT OSS 120B";
  if (m.includes("openrouter/auto")) return "OpenRouter Auto";
  if (m.includes("nemotron")) return "Nemotron 120B";
  return m;
}

export default function Topbar({ onMenuClick }) {
  const { state, dispatch } = useChat();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#212121] shrink-0">
      {/* hamburger (mobile) */}
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          onClick={onMenuClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* model selector */}
        <div className="dropdown dropdown-bottom">
          <div
            tabIndex={0}
            role="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 text-[#c96442]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3l14 9-14 9V3z"
              />
            </svg>
            <span className="text-[13px] font-medium text-white/80">
              {modelLabel(state.activeModel)}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          <ul
            tabIndex={0}
            className="dropdown-content z-50 mt-1 w-64 rounded-xl border border-white/10 bg-[#2a2a2a] shadow-xl p-1"
          >
            {state.models.map((m) => (
              <li key={m}>
                <button
                  onClick={() =>
                    dispatch({ type: "SET_ACTIVE_MODEL", model: m })
                  }
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[13px] transition-colors
                    ${
                      state.activeModel === m
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }
                  `}
                >
                  <span className="flex-1 truncate">{modelLabel(m)}</span>
                  {state.activeModel === m && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-3.5 h-3.5 text-[#c96442] shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* new chat button (desktop) */}
      <button
        onClick={() => dispatch({ type: "NEW_CHAT" })}
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors text-[13px]"
        title="New chat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 4v16m8-8H4"
          />
        </svg>
        New chat
      </button>
    </header>
  );
}
