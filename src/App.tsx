import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { ScrollToTop } from "./components/scroll-to-top";

const HomePage = lazy(() => import("./pages/home-page").then((module) => ({ default: module.HomePage })));
const ExplorePage = lazy(() => import("./pages/explore-page").then((module) => ({ default: module.ExplorePage })));
const EmitenDetailPage = lazy(() =>
  import("./pages/emiten-detail-page").then((module) => ({ default: module.EmitenDetailPage })),
);
const InvestorDetailPage = lazy(() =>
  import("./pages/investor-detail-page").then((module) => ({ default: module.InvestorDetailPage })),
);
const ControlPressurePage = lazy(() =>
  import("./pages/control-pressure-page").then((module) => ({ default: module.ControlPressurePage })),
);
const DebugPage = lazy(() => import("./pages/debug-page").then((module) => ({ default: module.DebugPage })));
const DetailDashboardPage = lazy(() =>
  import("./pages/detail-dashboard-page").then((module) => ({ default: module.DetailDashboardPage })),
);

function AppLoader() {
  return (
    <div className="page-shell flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D8CDBF] border-t-[#1D4C45]" />
      <span className="font-mono text-sm text-[#665A4F]">Memuat halaman...</span>
    </div>
  );
}

function HomeRoute() {
  const [searchParams] = useSearchParams();
  const emitenCode = searchParams.get("emiten")?.trim();
  const investorKey = searchParams.get("investor")?.trim();

  if (emitenCode) {
    return <Navigate to={`/emiten/${encodeURIComponent(emitenCode)}`} replace />;
  }

  if (investorKey) {
    return <Navigate to={`/investor/${encodeURIComponent(investorKey)}`} replace />;
  }

  return <HomePage />;
}

function EmitenDetailRoute() {
  const { shareCode = "" } = useParams();
  return <EmitenDetailPage shareCode={shareCode} />;
}

function InvestorDetailRoute() {
  const { investorKey = "" } = useParams();
  return <InvestorDetailPage investorKey={investorKey} />;
}

function IssuerWorkstationRoute() {
  return <DetailDashboardPage mode="issuer" />;
}

function InvestorWorkstationRoute() {
  return <DetailDashboardPage mode="investor" />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/control-pressure" element={<ControlPressurePage />} />
          <Route path="/emiten/:shareCode" element={<EmitenDetailRoute />} />
          <Route path="/investor/:investorKey" element={<InvestorDetailRoute />} />
          <Route path="/workstation/emiten/:shareCode" element={<IssuerWorkstationRoute />} />
          <Route path="/workstation/investor/:investorKey" element={<InvestorWorkstationRoute />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
