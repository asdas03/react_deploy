import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import recommendedProblemsTitle from "@/assets/recommended-problems-title.png";

interface WeaknessAnalysis {
  category: string;
  errorCount: number;
  errorRate: number;
  examples: string[];
}

interface RecommendedProblem {
  problem: string;
  category: string;
  difficulty: string;
  hint: string;
  answer: string;
  explanation: string;
}

const RecommendedProblems = () => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [weaknesses, setWeaknesses] = useState<WeaknessAnalysis[]>([]);
  const [recommendedProblems, setRecommendedProblems] = useState<RecommendedProblem[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [pdfList, setPdfList] = useState<any[]>([]);
  const [showAnswers, setShowAnswers] = useState<{ [key: number]: boolean }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndFetchData();
  }, [navigate]);

  const checkAuthAndFetchData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    await fetchPdfList(session.user.id);
    setLoading(false);
  };

  const fetchPdfList = async (userId: string) => {
    const { data, error } = await supabase
      .from("pdf_uploads")
      .select("id, file_name, extracted_text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("PDF 목록 로드 실패:", error);
      toast({
        title: "오류",
        description: "PDF 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } else {
      setPdfList(data || []);
    }
  };

  const analyzeWeaknessesForPdf = async (userId: string, pdfId: string) => {
    try {
      // Fetch wrong answers for specific PDF
      const { data: wrongAnswers, error } = await supabase
        .from("wrong_answers")
        .select("question, question_type, pdf_upload_id")
        .eq("user_id", userId)
        .eq("pdf_upload_id", pdfId);

      if (error) throw error;

      if (!wrongAnswers || wrongAnswers.length === 0) {
        toast({
          title: "오답 없음",
          description: "해당 PDF에 대한 오답이 없습니다.",
          variant: "destructive",
        });
        return null;
      }

      // Call edge function to analyze weaknesses
      const { data: analysisData, error: functionError } = await supabase.functions.invoke("analyze-weaknesses", {
        body: { wrongAnswers },
      });

      if (functionError) throw functionError;

      return analysisData.weaknesses || [];
    } catch (error: any) {
      console.error("약점 분석 실패:", error);
      toast({
        title: "분석 실패",
        description: error.message || "약점을 분석하는데 실패했습니다.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handlePdfSelection = async (pdfId: string) => {
    if (!user) return;

    setSelectedPdf(pdfId);
    setGenerating(true);
    setWeaknesses([]);
    setRecommendedProblems([]);
    setShowAnswers({});

    try {
      // 1. Analyze weaknesses for this PDF
      const analyzedWeaknesses = await analyzeWeaknessesForPdf(user.id, pdfId);
      if (!analyzedWeaknesses) {
        setGenerating(false);
        return;
      }

      setWeaknesses(analyzedWeaknesses);

      // 2. Generate recommended problems
      const pdf = pdfList.find((p) => p.id === pdfId);
      if (!pdf || !pdf.extracted_text) {
        throw new Error("PDF 텍스트를 찾을 수 없습니다.");
      }

      const { data, error } = await supabase.functions.invoke("generate-recommended-problems", {
        body: {
          weaknesses: analyzedWeaknesses,
          pdfText: pdf.extracted_text,
        },
      });

      if (error) throw error;

      setRecommendedProblems(data.problems || []);
      toast({
        title: "완료",
        description: "추천 문제가 생성되었습니다.",
      });
    } catch (error: any) {
      console.error("문제 생성 실패:", error);
      toast({
        title: "문제 생성 실패",
        description: error.message || "추천 문제를 생성하는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex justify-start mb-4">
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            메뉴로 돌아가기
          </Button>
        </div>

        <div className="mb-8 flex justify-center">
          <img src={recommendedProblemsTitle} alt="추천 문제" className="max-w-xl w-full" />
        </div>

        {generating && (
          <Alert className="mb-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>약점을 분석하고 문제를 생성하는 중...</AlertDescription>
          </Alert>
        )}

        {!selectedPdf && !generating && (
          <Card>
            <CardHeader>
              <CardTitle>PDF 선택</CardTitle>
              <CardDescription>추천 문제를 생성할 PDF를 선택하세요</CardDescription>
            </CardHeader>
            <CardContent>
              {pdfList.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>업로드된 PDF가 없습니다. 먼저 PDF를 업로드해주세요.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {pdfList.map((pdf) => (
                    <Button
                      key={pdf.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handlePdfSelection(pdf.id)}
                    >
                      {pdf.file_name}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {weaknesses.length > 0 && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>약점 분석 결과</CardTitle>
                <CardDescription>선택한 PDF의 오답 분석 결과입니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {weaknesses.map((weakness, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{weakness.category}</h3>
                        <span className="text-sm text-muted-foreground">오답률: {weakness.errorRate.toFixed(1)}%</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">총 {weakness.errorCount}개의 오답</p>
                      {weakness.examples.length > 0 && (
                        <div className="text-sm">
                          <p className="font-medium mb-1">예시:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {weakness.examples.slice(0, 2).map((example, i) => (
                              <li key={i} className="text-muted-foreground">
                                {example}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedPdf && recommendedProblems.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">추천 문제</h2>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedPdf(null);
                      setRecommendedProblems([]);
                      setWeaknesses([]);
                    }}
                  >
                    다른 PDF 선택
                  </Button>
                </div>
                {recommendedProblems.map((problem, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>문제 {index + 1}</CardTitle>
                        <div className="flex gap-2">
                          <span className="text-sm px-2 py-1 bg-yellow-100 dark:bg-yellow-900 rounded">
                            {problem.category}
                          </span>
                          <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">
                            {problem.difficulty}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="font-medium mb-2">문제:</p>
                        <p className="whitespace-pre-wrap">{problem.problem}</p>
                      </div>
                      {problem.hint && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-medium mb-1 text-sm">💡 힌트:</p>
                          <p className="text-sm">{problem.hint}</p>
                        </div>
                      )}
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAnswers((prev) => ({ ...prev, [index]: !prev[index] }))}
                          className="w-full"
                        >
                          {showAnswers[index] ? "답 숨기기" : "답 보기"}
                        </Button>
                        {showAnswers[index] && (
                          <div className="mt-4 space-y-3">
                            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="font-medium mb-2 text-green-900 dark:text-green-100">✓ 정답:</p>
                              <p className="text-green-800 dark:text-green-200 whitespace-pre-wrap">{problem.answer}</p>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="font-medium mb-2 text-blue-900 dark:text-blue-100">📝 해설:</p>
                              <p className="text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                                {problem.explanation}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecommendedProblems;
