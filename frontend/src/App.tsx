import { Toaster } from "@/components/ui/toaster";
import { ChatPage } from "@/pages/ChatPage";
import { HomePage } from "@/pages/HomePage";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

export function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route element={<ChatPage />} path="/" />
        <Route element={<ChatPage />} path="/chat" />
        <Route element={<HomePage />} path="/home" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
