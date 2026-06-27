import { useChat } from "../../context/ChatContext";

const starters = [
  {
    icon: (
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
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
    color: "text-[#c96442]",
    title: "Search the web",
    desc: "Latest news, prices, live events",
    prompt: "Search the web for the latest AI news today",
  },
  {
    icon: (
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    color: "text-violet-400",
    title: "Summarize a document",
    desc: "Upload a PDF, DOCX, CSV or TXT",
    prompt: "I have a document I'd like you to summarize",
  },
  {
    icon: (
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
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    color: "text-amber-400",
    title: "Save to memory",
    desc: "Remember facts across conversations",
    prompt: "Remember that my name is Axio and I prefer concise answers",
  },
  {
    icon: (
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
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
    color: "text-sky-400",
    title: "Run a calculation",
    desc: "Math, unit conversions, formulas",
    prompt: "Calculate 125 × 48 ÷ 6 and show me the steps",
  },
];

export default function EmptyState() {
  const { sendMessage } = useChat();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
      {/* logo */}
      <div className="w-12 h-12 rounded-2xl bg-[#c96442] flex items-center justify-center mb-5">
        <svg
          width="22"
          height="22"
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

      <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">
        What can I help with?
      </h1>
      <p className="text-[14px] text-white/40 text-center max-w-sm mb-8 leading-relaxed">
        Search the web, read documents, remember things, run calculations — and
        more.
      </p>

      {/* prompt cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {starters.map((s) => (
          <button
            key={s.title}
            onClick={() => sendMessage(s.prompt)}
            className="flex flex-col items-start gap-3 p-4 rounded-xl bg-[#2f2f2f] border border-white/[0.07] hover:bg-[#3a3a3a] hover:border-white/15 transition-all text-left"
          >
            <span className={s.color}>{s.icon}</span>
            <div>
              <p className="text-[13px] font-medium text-white/90">{s.title}</p>
              <p className="text-[12px] text-white/35 mt-0.5 leading-snug">
                {s.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
