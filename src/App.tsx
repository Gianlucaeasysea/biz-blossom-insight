import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
import MetaAds from "./pages/MetaAds";
import Budget2026 from "./pages/Budget2026";
import GeoInsights from "./pages/GeoInsights";
import ProductAnalysis from "./pages/ProductAnalysis";
import B2CCustomers from "./pages/B2CCustomers";
import B2BAnalysis from "./pages/B2BAnalysis";
import B2CAnalysis from "./pages/B2CAnalysis";
import SalesCallAnalysis from "./pages/SalesCallAnalysis";
import Stock from "./pages/Stock";
import Frank from "./pages/Frank";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { LanguageProvider } from "./contexts/LanguageContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/meta-ads" element={<ProtectedRoute><MetaAds /></ProtectedRoute>} />
          <Route path="/budget-2026" element={<ProtectedRoute><Budget2026 /></ProtectedRoute>} />
          <Route path="/geo-insights" element={<ProtectedRoute><GeoInsights /></ProtectedRoute>} />
          <Route path="/product-analysis" element={<ProtectedRoute><ProductAnalysis /></ProtectedRoute>} />
          <Route path="/b2c-customers" element={<ProtectedRoute><B2CCustomers /></ProtectedRoute>} />
          <Route path="/b2b-analysis" element={<ProtectedRoute><B2BAnalysis /></ProtectedRoute>} />
          <Route path="/b2c-analysis" element={<ProtectedRoute><B2CAnalysis /></ProtectedRoute>} />
          <Route path="/sales-call" element={<ProtectedRoute><SalesCallAnalysis /></ProtectedRoute>} />
          <Route path="/stock" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
          <Route path="/frank" element={<ProtectedRoute><Frank /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
