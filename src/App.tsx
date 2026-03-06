import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ScrollToTop } from "./components/scroll-to-top";

const HomePage = lazy(() => import("./pages/home-page").then((module) => ({ default: module.HomePage })));
const EmitenDetailPage = lazy(() =>
  import("./pages/emiten-detail-page").then((module) => ({ default: module.EmitenDetailPage })),
);
const InvestorDetailPage = lazy(() =>
  import("./pages/investor-detail-page").then((module) => ({ default: module.InvestorDetailPage })),
);

export default function App() {
  const [searchParams] = useSearchParams();
  const emitenCode = searchParams.get("emiten");
  const investorKey = searchParams.get("investor");
  
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={
        <div className="min-h-screen bg-nebula flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal/20 border-t-teal" />
          <span className="text-sm text-muted font-mono">Memuat halaman…</span>
        </div>
      }>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        <AnimatePresence mode="wait">
          {emitenCode && <EmitenDetailPage key="emiten-sheet" shareCode={emitenCode} />}
          {investorKey && <InvestorDetailPage key="investor-sheet" investorKey={investorKey} />}
        </AnimatePresence>
      </Suspense>
    </>
  );
}
