import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import {
  getModels,
  getConversations,
  getHistory,
  streamChat,
} from "../api/client";

const ChatContext = createContext(null);

const initialState = {
  models: [],
  activeModel: "models/gemini-2.5-flash",

  conversations: [],
  activeThreadId: null,

  messages: [],

  isStreaming: false,
  toolActivity: null,
  pendingDocId: null,

  loadingConversations: false,
  loadingHistory: false,
  error: null,
};
function reducer(state, action) {
  switch (action.type) {
    case "SET_MODELS":
      return {
        ...state,
        models: action.list,
        activeModel: action.defaultModel,
      };

    case "SET_ACTIVE_MODEL":
      return { ...state, activeModel: action.model };

    case "SET_CONVERSATIONS_LOADING":
      return { ...state, loadingConversations: action.value };

    case "SET_CONVERSATIONS":
      return {
        ...state,
        conversations: action.conversations,
        loadingConversations: false,
      };

    case "PREPEND_CONVERSATION":
      return {
        ...state,
        conversations: [action.conversation, ...state.conversations],
      };

    case "UPDATE_CONVERSATION_TITLE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.thread_id === action.threadId ? { ...c, title: action.title } : c,
        ),
      };

    case "DELETE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.filter(
          (c) => c.thread_id !== action.threadId,
        ),
        activeThreadId:
          state.activeThreadId === action.threadId
            ? null
            : state.activeThreadId,
        messages:
          state.activeThreadId === action.threadId ? [] : state.messages,
      };

    case "SET_ACTIVE_THREAD":
      return {
        ...state,
        activeThreadId: action.threadId,
        messages: [],
        error: null,
      };

    case "SET_HISTORY_LOADING":
      return { ...state, loadingHistory: action.value };

    case "SET_HISTORY":
      return { ...state, messages: action.messages, loadingHistory: false };

    case "NEW_CHAT":
      return {
        ...state,
        activeThreadId: null,
        messages: [],
        pendingDocId: null,
        error: null,
      };

    case "ADD_USER_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.id, role: "user", content: action.content },
        ],
      };

    case "ADD_ASSISTANT_PLACEHOLDER":
      return {
        ...state,
        isStreaming: true,
        messages: [
          ...state.messages,
          {
            id: action.id,
            role: "assistant",
            content: "",
            streaming: true,
            error: false,
          },
        ],
      };

    case "SET_THREAD_ID_FROM_STREAM":
      return { ...state, activeThreadId: action.threadId };

    case "APPEND_CHUNK":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, content: m.content + action.chunk } : m,
        ),
      };

    case "FINISH_STREAM":
      return {
        ...state,
        isStreaming: false,
        toolActivity: null,
        pendingDocId: null,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, streaming: false } : m,
        ),
      };

    case "STREAM_ERROR":
      return {
        ...state,
        isStreaming: false,
        toolActivity: null,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? { ...m, streaming: false, error: true, content: action.message }
            : m,
        ),
      };

    case "SET_TOOL_ACTIVITY":
      return { ...state, toolActivity: action.label };

    case "SET_PENDING_DOC":
      return { ...state, pendingDocId: action.docId };

    case "CLEAR_PENDING_DOC":
      return { ...state, pendingDocId: null };

    case "SET_ERROR":
      return { ...state, error: action.message };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // load models + conversations on mount
  useEffect(() => {
    async function bootstrap() {
      try {
        const { list, defaultModel } = await getModels();
        dispatch({ type: "SET_MODELS", list, defaultModel });
      } catch (err) {
        console.error("Failed to load models:", err);
      }

      try {
        dispatch({ type: "SET_CONVERSATIONS_LOADING", value: true });
        const data = await getConversations();
        const list = Array.isArray(data) ? data : (data.conversations ?? []);
        dispatch({ type: "SET_CONVERSATIONS", conversations: list });
      } catch (err) {
        console.error("Failed to load conversations:", err);
        dispatch({ type: "SET_CONVERSATIONS_LOADING", value: false });
      }
    }
    bootstrap();
  }, []);

  const selectConversation = useCallback(
    async (threadId) => {
      if (threadId === state.activeThreadId) return;
      dispatch({ type: "SET_ACTIVE_THREAD", threadId });

      try {
        dispatch({ type: "SET_HISTORY_LOADING", value: true });
        const data = await getHistory(threadId);
        const messages = Array.isArray(data) ? data : (data.messages ?? []);
        const normalised = messages.map((m, i) => ({
          id: m.id ?? `hist-${i}`,
          role: m.role,
          content: m.content,
          streaming: false,
          error: false,
        }));
        dispatch({ type: "SET_HISTORY", messages: normalised });
      } catch (err) {
        console.error("Failed to load history:", err);
        dispatch({ type: "SET_HISTORY_LOADING", value: false });
        dispatch({
          type: "SET_ERROR",
          message: "Could not load conversation history.",
        });
      }
    },
    [state.activeThreadId],
  );

  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || state.isStreaming) return;

      const userMsgId = `user-${Date.now()}`;
      const asstMsgId = `asst-${Date.now() + 1}`;

      dispatch({ type: "ADD_USER_MESSAGE", id: userMsgId, content });
      dispatch({ type: "ADD_ASSISTANT_PLACEHOLDER", id: asstMsgId });

      try {
        const res = await streamChat({
          message: content,
          threadId: state.activeThreadId,
          model: state.activeModel,
          docId: state.pendingDocId,
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const raw = decoder.decode(value, { stream: true });

          for (const line of raw.split("\n")) {
            if (!line.startsWith("data: ")) continue;

            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            // Tool activity: data: [TOOL:Searching the web…]
            if (data.startsWith("[TOOL:") && data.endsWith("]")) {
              dispatch({ type: "SET_TOOL_ACTIVITY", label: data.slice(6, -1) });
              continue;
            }

            // New thread id: data: [THREAD:abc123]
            if (data.startsWith("[THREAD:") && data.endsWith("]")) {
              const threadId = data.slice(8, -1);
              dispatch({ type: "SET_THREAD_ID_FROM_STREAM", threadId });
              if (!state.activeThreadId) {
                dispatch({
                  type: "PREPEND_CONVERSATION",
                  conversation: {
                    thread_id: threadId,
                    title: content.slice(0, 50),
                    created_at: new Date().toISOString(),
                  },
                });
              }
              continue;
            }

            // Try JSON delta (OpenAI-style or backend {"token":"..."})
            try {
              const parsed = JSON.parse(data);
              if (parsed?.error) {
                dispatch({
                  type: "STREAM_ERROR",
                  id: asstMsgId,
                  message: parsed.error,
                });
                break;
              }
              const chunk =
                parsed?.choices?.[0]?.delta?.content ??
                parsed?.content ??
                parsed?.text ??
                parsed?.token ??
                "";
              if (chunk)
                dispatch({ type: "APPEND_CHUNK", id: asstMsgId, chunk });
            } catch {
              // Plain text chunk fallback
              if (data)
                dispatch({ type: "APPEND_CHUNK", id: asstMsgId, chunk: data });
            }
          }
        }

        dispatch({ type: "FINISH_STREAM", id: asstMsgId });

        // Update sidebar title on first message of existing thread
        if (state.activeThreadId) {
          dispatch({
            type: "UPDATE_CONVERSATION_TITLE",
            threadId: state.activeThreadId,
            title: content.slice(0, 50),
          });
        }
      } catch (err) {
        console.error("Stream error:", err);
        dispatch({
          type: "STREAM_ERROR",
          id: asstMsgId,
          message: "Something went wrong. Please try again.",
        });
      }
    },
    [
      state.isStreaming,
      state.activeThreadId,
      state.activeModel,
      state.pendingDocId,
    ],
  );

  const refreshConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      const list = Array.isArray(data) ? data : (data.conversations ?? []);
      dispatch({ type: "SET_CONVERSATIONS", conversations: list });
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        state,
        dispatch,
        sendMessage,
        selectConversation,
        refreshConversations,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
