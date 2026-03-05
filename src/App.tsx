import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

const HomePage = lazy(() => import("./pages/home-page").then((module) => ({ default: module.HomePage })));
const EmitenDetailPage = lazy(() =>
  import("./pages/emiten-detail-page").then((module) => ({ default: module.EmitenDetailPage })),
);
const InvestorDetailPage = lazy(() =>
  import("./pages/investor-detail-page").then((module) => ({ default: module.InvestorDetailPage })),
);

export default function App() {
  const location = useLocation();
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-nebula flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal/20 border-t-teal" />
        <span className="text-sm text-muted font-mono">Memuat halaman…</span>
      </div>
    }>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
          <Route path="/emiten/:shareCode" element={<EmitenDetailPage />} />
          <Route path="/investor/:investorKey" element={<InvestorDetailPage />} />
          <Route path="/explore" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
