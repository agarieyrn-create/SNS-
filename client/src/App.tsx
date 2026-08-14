import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import GrowthCopilot from "./pages/GrowthCopilot";
import NotFound from "./pages/NotFound";

function Router() {
  return <Switch>
    {["/", "/ideas", "/drafts", "/results", "/analysis", "/settings"].map(path => <Route key={path} path={path}><DashboardLayout><GrowthCopilot /></DashboardLayout></Route>)}
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
