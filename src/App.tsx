import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import MetaAds from "./pages/MetaAds";
import Budget2026 from "./pages/Budget2026";
import GeoInsights from "./pages/GeoInsights";
import ProductAnalysis from "./pages/ProductAnalysis";
import B2CCustomers from "./pages/B2CCustomers";
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
          <Route path="/" element={<Index />} />
          <Route path="/meta-ads" element={<MetaAds />} />
          <Route path="/budget-2026" element={<Budget2026 />} />
          <Route path="/geo-insights" element={<GeoInsights />} />
          <Route path="/product-analysis" element={<ProductAnalysis />} />
          <Route path="/b2c-customers" element={<B2CCustomers />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
