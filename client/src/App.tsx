import DashboardLayout from "@/components/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import type { ReactNode } from "react";
import { Route, Router as WouterRouter, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import GlobalStocks from "./pages/GlobalStocks";
import CryptoSectors from "./pages/CryptoSectors";
import BinanceFutures from "./pages/BinanceFutures";

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

function AppRoutes() {
  return (
    <Switch>
      <Route path={"/binance-futures"} component={BinanceFutures} />
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
