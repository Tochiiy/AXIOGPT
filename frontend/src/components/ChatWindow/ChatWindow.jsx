import { useEffect, useRef } from "react";
import { useChat } from "../../context/ChatContext";
import MessageBubble from "../MessageBubble/MessageBubble";
import EmptyState from "../EmptyState/EmptyState";

export default function ChatWindow() {
  const { state } = useChat();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  return (
    <div className="flex-1 overflow-y-auto relative">
      {state.messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* skeleton loader for history */}
          {state.loadingHistory && (
            <div className="flex flex-col gap-6 animate-pulse">
              {[80, 60, 90, 50].map((w, i) => (
                <div
                  key={i}
                  className={`flex ${i % 2 === 0 ? "justify-end" : "gap-3"}`}
                >
                  {i % 2 !== 0 && (
                    <div className="w-7 h-7 rounded-lg bg-white/10 shrink-0" />
                  )}
                  <div
                    className={`h-10 rounded-xl bg-white/10`}
                    style={{ width: `${w}%` }}
                  />
                </div>
              ))}
            </div>
          )}

          {!state.loadingHistory &&
            state.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

          <div ref={bottomRef} />
        </div>
      )}

      {/* tool activity toast */}
      {state.toolActivity && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-2 bg-[#2f2f2f] border border-white/10 rounded-full px-4 py-2 shadow-xl text-[12px] text-white/60">
            <span className="loading loading-spinner loading-xs text-[#c96442]"></span>
            {state.toolActivity}
          </div>
        </div>
      )}
    </div>
  );
}
