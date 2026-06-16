import DashboardLayout from "@/components/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path={"/binance-futures"} component={BinanceFutures} />
      <Route component={AuthenticatedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
