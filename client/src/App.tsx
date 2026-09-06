import DashboardLayout from "@/components/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import {
  type FormEvent,
  type ReactNode,
  lazy,
  Suspense,
  useState,
} from "react";
import { Route, Router as WouterRouter, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
const Home = lazy(() => import("./pages/Home"));
const GlobalStocks = lazy(() => import("./pages/GlobalStocks"));
const CryptoSectors = lazy(() => import("./pages/CryptoSectors"));
const BinanceFutures = lazy(() => import("./pages/BinanceFutures"));

const BINANCE_ACCESS_CODE = ["5", "6", "9", "0"].join("");
const BINANCE_ACCESS_STORAGE_KEY = "kjhstock-binance-access";

function AuthenticatedRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/global-stocks"} component={GlobalStocks} />
        <Route path={"/crypto-sectors"} component={CryptoSectors} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function BinanceAccessGate() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.sessionStorage.getItem(BINANCE_ACCESS_STORAGE_KEY) === "granted"
    );
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim() === BINANCE_ACCESS_CODE) {
      window.sessionStorage.setItem(BINANCE_ACCESS_STORAGE_KEY, "granted");
      setIsUnlocked(true);
      setError("");
      return;
    }

    setError("코드가 맞지 않습니다.");
    setCode("");
  };

  if (isUnlocked) {
    return <BinanceFutures />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10 text-slate-950">
      <section className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-6 shadow-2xl shadow-slate-300/60">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            KJHSTOCK
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-normal text-slate-950">
            접근 코드 입력
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label
            className="block text-sm font-bold text-slate-700"
            htmlFor="binance-access-code"
          >
            코드
          </label>
          <input
            id="binance-access-code"
            aria-label="접근 코드"
            autoComplete="one-time-code"
            className="h-12 w-full rounded-md border border-slate-400 bg-white px-4 text-center text-xl font-black tracking-[0.4em] text-slate-950 shadow-inner outline-none transition [color-scheme:light] [-webkit-text-security:disc] placeholder:text-slate-400 selection:bg-cyan-200 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/30"
            inputMode="numeric"
            maxLength={4}
            onChange={event => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 4));
              setError("");
            }}
            pattern="[0-9]*"
            type="text"
            value={code}
          />
          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}
          <button
            className="h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:ring-offset-white"
            type="submit"
          >
            입장
          </button>
        </form>
      </section>
    </main>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path={"/"} component={BinanceAccessGate} />
      <Route path={"/binance-futures"} component={BinanceAccessGate} />
      <Route component={AuthenticatedRoutes} />
    </Switch>
  );
}

function RouterProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_ROUTER_MODE === "hash") {
    return <WouterRouter hook={useHashLocation}>{children}</WouterRouter>;
  }

  return <WouterRouter>{children}</WouterRouter>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <RouterProvider>
            <Suspense
              fallback={
                <main className="p-6 text-sm text-slate-600" role="status">
                  화면을 불러오는 중입니다.
                </main>
              }
            >
              <AppRoutes />
            </Suspense>
          </RouterProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
