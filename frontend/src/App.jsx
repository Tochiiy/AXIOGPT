import { useState } from "react";
import { ChatProvider } from "./context/ChatContext";
import Sidebar from "./components/Sidebar/Sidebar";
import Topbar from "./components/Topbar/Topbar";
import ChatWindow from "./components/ChatWindow/ChatWindow";
import InputBar from "./components/InputBar/InputBar";

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <ChatWindow />
        <InputBar />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <Layout />
    </ChatProvider>
  );
}
