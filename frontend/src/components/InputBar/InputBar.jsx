import { useState, useRef, useCallback, useEffect } from "react";
import { useChat } from "../../context/ChatContext";
import { uploadFile } from "../../api/client";
 
// speech-to-text via Web Speech API
function useSpeech(onResult) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
 
  const toggle = useCallback(() => {
    if (!supported) { alert("Speech recognition is not supported in this browser. Try Chrome."); return; }
 
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
 
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
 
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => setListening(false);
 
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join("");
      onResult(transcript, e.results[e.results.length - 1].isFinal);
    };
 
    recRef.current = rec;
    rec.start();
  }, [listening, supported, onResult]);
 
  useEffect(() => () => recRef.current?.stop(), []);
 
  return { listening, toggle, supported };
}
 

export default function InputBar() {
  const { state, dispatch, sendMessage } = useChat();
  const [input, setInput]               = useState("");
  const [dragging, setDragging]         = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const taRef  = useRef(null);
  const fileRef = useRef(null);
 
  const grow = (el) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };
 
  // interim results fill the box, final auto-sends
  const handleSpeechResult = useCallback((transcript, isFinal) => {
    setInput(transcript);
    setTimeout(() => {
      if (taRef.current) grow(taRef.current);
    }, 0);
    if (isFinal && transcript.trim()) {
      // slight delay so user sees the text before it sends
      setTimeout(() => {
        sendMessage(transcript.trim());
        setInput("");
        if (taRef.current) taRef.current.style.height = "auto";
      }, 400);
    }
  }, [sendMessage]);
 
  const { listening, toggle: toggleMic, supported: micSupported } = useSpeech(handleSpeechResult);
 
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || state.isStreaming) return;
    sendMessage(text);
    setInput("");
    setUploadedFile(null);
    if (taRef.current) taRef.current.style.height = "auto";
  }, [input, state.isStreaming, sendMessage]);
 
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };
 
  const handleFile = async (file) => {
    const ok = /\.(pdf|txt|md|csv|py|docx)$/i.test(file.name);
    if (!ok) { alert("Supported: PDF, DOCX, TXT, MD, PY, CSV"); return; }
    setUploading(true);
    try {
      const result = await uploadFile(file, state.activeThreadId);
      dispatch({ type: "SET_PENDING_DOC", docId: result.doc_id });
      setUploadedFile(file.name);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };
 
  const canSend = input.trim().length > 0 && !state.isStreaming && !uploading;
 
  return (
    <div className="border-t border-white/[0.07] bg-[#212121] px-4 py-3 md:px-6 md:py-4">
      <div className="max-w-3xl mx-auto">
 
        {/* File badge */}
        {uploadedFile && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="flex items-center gap-2 bg-[#2f2f2f] border border-white/10 rounded-lg px-3 py-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-[#c96442] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span className="text-[12px] text-white/60 truncate max-w-[200px]">{uploadedFile}</span>
              <button onClick={() => { setUploadedFile(null); dispatch({ type: "CLEAR_PENDING_DOC" }); }}
                className="text-white/30 hover:text-white/60 ml-1 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        )}
 
        {/* Input box */}
        <div
          className={`flex items-end gap-2 px-4 py-3 rounded-2xl border transition-colors duration-150
            ${dragging
              ? "border-[#c96442]/50 bg-[#c96442]/5"
              : listening
                ? "border-[#c96442]/40 bg-[#2f2f2f]"
                : "border-white/10 bg-[#2f2f2f] focus-within:border-white/20"}
          `}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        >
          {/* Attach */}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="shrink-0 p-1 text-white/30 hover:text-white/60 transition-colors mb-0.5" title="Attach file">
            {uploading
              ? <span className="loading loading-spinner loading-xs text-[#c96442]"></span>
              : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                </svg>
            }
          </button>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.py,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}/>
 
          {/* Textarea */}
          <textarea
            ref={taRef}
            value={input}
            onChange={e => { setInput(e.target.value); grow(e.target); }}
            onKeyDown={handleKey}
            placeholder={
              listening  ? "Listening…" :
              dragging   ? "Drop file here…" :
              "Message AxioGPT…"
            }
            rows={1}
            disabled={state.isStreaming}
            className="flex-1 bg-transparent outline-none resize-none text-[14px] text-white/85 placeholder:text-white/25 leading-relaxed py-0.5 min-h-[22px] max-h-[160px] font-sans"
          />
 
          {/* Mic button */}
          <button
            onClick={toggleMic}
            disabled={state.isStreaming || !micSupported}
            title={listening ? "Stop listening" : "Voice input"}
            className={`shrink-0 p-1 transition-all mb-0.5 rounded-lg
              ${listening
                ? "text-[#c96442] animate-pulse"
                : "text-white/30 hover:text-white/60"}
              ${!micSupported ? "opacity-30 cursor-not-allowed" : ""}
            `}
          >
            {listening
              ? /* active */
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12h-3m-3 0a1 1 0 01-1-1V7a1 1 0 012 0v4a1 1 0 01-1 1zm-3 0H9m-3 0H3m6 0a1 1 0 01-1-1V5a1 1 0 012 0v6a1 1 0 01-1 1zm6 0a1 1 0 01-1-1v-1a1 1 0 012 0v1a1 1 0 01-1 1z"/>
                </svg>
              : /* idle */
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M9 11V7a3 3 0 016 0v4a3 3 0 01-6 0z"/>
                </svg>
            }
          </button>
 
          {/* Send */}
          <button onClick={handleSend} disabled={!canSend}
            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all mb-0.5
              ${canSend ? "bg-[#c96442] hover:bg-[#b85838] text-white" : "bg-white/5 text-white/15 cursor-not-allowed"}
            `}>
            {state.isStreaming
              ? <span className="loading loading-spinner loading-xs"></span>
              : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                </svg>
            }
          </button>
        </div>
 
        <p className="text-center text-[11px] text-white/20 mt-2">
          AxioGPT can make mistakes. Please verify important information.
        </p>
      </div>
    </div>
  );
}