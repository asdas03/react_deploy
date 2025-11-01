import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Menu from "./pages/Menu";
import PdfUpload from "./pages/PdfUpload";
import ProblemSolving from "./pages/ProblemSolving";
import WrongAnswers from "./pages/WrongAnswers";
import RecommendedProblems from "./pages/RecommendedProblems";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Menu />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/pdf-upload" element={<PdfUpload />} />
          <Route path="/problem-solving" element={<ProblemSolving />} />
          <Route path="/wrong-answers" element={<WrongAnswers />} />
          <Route path="/recommended-problems" element={<RecommendedProblems />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
