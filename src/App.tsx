import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const HomePage = lazy(() => import("./pages/home-page").then((module) => ({ default: module.HomePage })));
const EmitenDetailPage = lazy(() =>
  import("./pages/emiten-detail-page").then((module) => ({ default: module.EmitenDetailPage })),
);
const InvestorDetailPage = lazy(() =>
  import("./pages/investor-detail-page").then((module) => ({ default: module.InvestorDetailPage })),
);

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/emiten/:shareCode" element={<EmitenDetailPage />} />
        <Route path="/investor/:investorKey" element={<InvestorDetailPage />} />
        <Route path="/explore" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
