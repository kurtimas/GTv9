import { Routes, Route } from "react-router";
import OfficeLayout from "./components/OfficeLayout";
import OfficeHome from "./pages/OfficeHome";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <OfficeLayout>
      <Routes>
        <Route path="/" element={<OfficeHome />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </OfficeLayout>
  );
}
