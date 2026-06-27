import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="text-white/30 hover:text-white/70 transition-colors text-xs flex items-center gap-1"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ActionButtons({ content }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const doCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 mt-3">
      <button
        onClick={doCopy}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors text-[12px]"
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
        {copied ? "Copied" : "Copy"}
      </button>
      <button
        onClick={() => setFeedback(feedback === "like" ? null : "like")}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-[12px] ${
          feedback === "like"
            ? "text-green-400 bg-white/5"
            : "text-white/30 hover:text-white/60 hover:bg-white/5"
        }`}
        title="Good response"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      </button>
      <button
        onClick={() => setFeedback(feedback === "dislike" ? null : "dislike")}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-[12px] ${
          feedback === "dislike"
            ? "text-red-400 bg-white/5"
            : "text-white/30 hover:text-white/60 hover:bg-white/5"
        }`}
        title="Bad response"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2" />
        </svg>
      </button>
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[78%] md:max-w-[65%] bg-[#2f2f2f] border border-white/[0.07] rounded-2xl rounded-tr-sm px-4 py-3 text-[14px] text-white/90 leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6">
      {/* avatar */}
      <div className="w-7 h-7 rounded-lg bg-[#c96442] flex items-center justify-center shrink-0 mt-0.5">
        <svg
          width="14"
          height="14"
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

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-white/30 mb-2 uppercase tracking-wider">
          AxioGPT
        </p>

        {message.error ? (
          <p className="text-red-400 text-[14px]">{message.content}</p>
        ) : (
          <div
            className={`text-[14px] leading-[1.75] text-white/85 ${message.streaming ? "streaming-cursor" : ""}`}
          >
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  if (!inline && match) {
                    const code = String(children).replace(/\n$/, "");
                    return (
                      <div className="my-3 rounded-xl overflow-hidden border border-white/10">
                        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/[0.07]">
                          <span className="text-[11px] text-white/30 uppercase tracking-wider">
                            {match[1]}
                          </span>
                          <CopyButton text={code} />
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            background: "transparent",
                            padding: "16px",
                            fontSize: "13px",
                          }}
                          {...props}
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return (
                    <code
                      className="bg-white/10 border border-white/10 rounded px-1.5 py-0.5 text-[12px] font-mono text-white/80"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 mb-3 space-y-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-white/80">{children}</li>
                ),
                h1: ({ children }) => (
                  <h1 className="text-lg font-semibold text-white mb-2 mt-4">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold text-white mb-2 mt-3">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-[14px] font-semibold text-white mb-1 mt-2">
                    {children}
                  </h3>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-white">
                    {children}
                  </strong>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[#c96442] pl-4 my-3 text-white/50 italic">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#c96442] underline underline-offset-2 hover:text-[#e07050]"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="border-white/10 my-4" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="w-full text-[13px] border-collapse">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 bg-white/5 border border-white/10 text-left text-white/70 font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 border border-white/[0.07] text-white/60">
                    {children}
                  </td>
                ),
              }}
            >
              {message.content || (message.streaming ? "\u200b" : "")}
            </ReactMarkdown>
          </div>
        )}

        {/* action buttons (visible after stream) */}
        {!message.streaming && !message.error && message.content && (
          <ActionButtons content={message.content} />
        )}
      </div>
    </div>
  );
}
