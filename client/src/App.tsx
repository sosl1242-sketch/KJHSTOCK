import DashboardLayout from "@/components/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { type FormEvent, type ReactNode, useState } from "react";
import { Route, Router as WouterRouter, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import GlobalStocks from "./pages/GlobalStocks";
import CryptoSectors from "./pages/CryptoSectors";
import BinanceFutures from "./pages/BinanceFutures";

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
    return window.sessionStorage.getItem(BINANCE_ACCESS_STORAGE_KEY) === "granted";
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10 text-slate-100">
      <section className="w-full max-w-sm rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">KJHSTOCK</p>
          <h1 className="mt-3 text-2xl font-bold tracking-normal text-white">접근 코드 입력</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-200" htmlFor="binance-access-code">
            코드
          </label>
          <input
            id="binance-access-code"
            className="h-12 w-full rounded-md border border-white/15 bg-slate-900 px-4 text-center text-xl font-semibold tracking-[0.4em] text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 4));
              setError("");
            }}
            pattern="[0-9]*"
            type="password"
            value={code}
          />
          {error ? <p className="text-sm font-medium text-red-300">{error}</p> : null}
          <button
            className="h-11 w-full rounded-md bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
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
            <AppRoutes />
          </RouterProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
