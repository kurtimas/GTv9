import { Routes, Route } from "react-router";
import { Toaster } from "sonner";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
      <Toaster richColors position="top-center" />
    </>
  );
}
