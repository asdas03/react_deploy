import { useCallback, useState, useEffect } from "react";
import { Upload, FileText, Copy, Download, Check, Sparkles, CheckCircle2, XCircle, History, Trash2, PenLine, Brain, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from "pdfjs-dist";
import { createWorker } from "tesseract.js";
import { LatexRenderer } from "./LatexRenderer";

// Configure PDF.js worker with unpkg CDN (more reliable)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface Question {
  question: string;
  answer: boolean;
  explanation: string;
}

interface AnalysisResult {
  questions: Question[];
  summary: string;
}

interface FillBlankQuestion {
  question: string;
  answer: string;
  hint: string;
}

interface FillBlankResult {
  questions: FillBlankQuestion[];
}

interface MultipleChoiceQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface MultipleChoiceResult {
  questions: MultipleChoiceQuestion[];
}

interface ShortAnswerQuestion {
  question: string;
  answer: string;
  keywords: string[];
  explanation: string;
}

interface ShortAnswerResult {
  questions: ShortAnswerQuestion[];
}

interface ProblemSolution {
  problem: string;
  solution: string;
  keyPoints: string;
}

interface SolveResult {
  problems: ProblemSolution[];
}

interface PdfUploadRecord {
  id: string;
  file_name: string;
  file_path: string;
  extracted_text: string | null;
  created_at: string;
}

interface PdfUploaderProps {
  mode?: 'full' | 'solve-only';
}

export const PdfUploader = ({ mode = 'full' }: PdfUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [fileName, setFileName] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [userAnswers, setUserAnswers] = useState<(boolean | null)[]>([]);
  const [uploadHistory, setUploadHistory] = useState<PdfUploadRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isGeneratingBlanks, setIsGeneratingBlanks] = useState(false);
  const [fillBlankResult, setFillBlankResult] = useState<FillBlankResult | null>(null);
  const [fillBlankAnswers, setFillBlankAnswers] = useState<string[]>([]);
  const [showFillBlankAnswers, setShowFillBlankAnswers] = useState<boolean[]>([]);
  const [isGeneratingMultipleChoice, setIsGeneratingMultipleChoice] = useState(false);
  const [multipleChoiceResult, setMultipleChoiceResult] = useState<MultipleChoiceResult | null>(null);
  const [multipleChoiceAnswers, setMultipleChoiceAnswers] = useState<(number | null)[]>([]);
  const [isGeneratingShortAnswer, setIsGeneratingShortAnswer] = useState(false);
  const [shortAnswerResult, setShortAnswerResult] = useState<ShortAnswerResult | null>(null);
  const [shortAnswerAnswers, setShortAnswerAnswers] = useState<string[]>([]);
  const [showShortAnswers, setShowShortAnswers] = useState<boolean[]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [currentPdfUploadId, setCurrentPdfUploadId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUploadHistory();
  }, []);

  const fetchUploadHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('pdf_uploads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUploadHistory(data || []);
    } catch (error) {
      console.error('업로드 기록 불러오기 오류:', error);
    }
  };

  const extractTextFromPdf = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      // Initialize Tesseract worker for OCR
      const worker = await createWorker("kor+eng");

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Extract text content
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");

        // Render page to canvas for OCR
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          }).promise;

          // Perform OCR on the rendered page
          const {
            data: { text: ocrText },
          } = await worker.recognize(canvas);

          // Combine regular text extraction with OCR text
          fullText += pageText + "\n" + ocrText + "\n\n";
        } else {
          fullText += pageText + "\n\n";
        }
      }

      await worker.terminate();

      const extractedContent = fullText.trim();
      setExtractedText(extractedContent);

      // Save to database and storage
      await savePdfToDatabase(file, extractedContent);

      toast({
        title: "성공!",
        description: `${pdf.numPages}페이지에서 텍스트와 이미지를 인식했습니다.`,
      });
    } catch (error) {
      console.error("PDF 처리 중 오류:", error);
      toast({
        title: "오류",
        description: "PDF 파일을 처리하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const savePdfToDatabase = async (file: File, extractedText: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");

      // Upload to storage with safe file path
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const safeFilePath = `${user.id}/${timestamp}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(safeFilePath, file);

      if (uploadError) throw uploadError;

      // Save metadata to database
      const { data: uploadData, error: dbError } = await supabase
        .from('pdf_uploads')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: safeFilePath,
          extracted_text: extractedText,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Set current PDF upload ID
      if (uploadData) {
        setCurrentPdfUploadId(uploadData.id);
      }

      // Refresh history
      await fetchUploadHistory();
    } catch (error) {
      console.error("데이터베이스 저장 오류:", error);
      toast({
        title: "저장 오류",
        description: "파일을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const loadUploadedPdf = async (record: PdfUploadRecord) => {
    try {
      setFileName(record.file_name);
      setExtractedText(record.extracted_text || "");
      setCurrentPdfUploadId(record.id);
      setAnalysisResult(null);
      setUserAnswers([]);
      setShowHistory(false);

      toast({
        title: "불러오기 완료",
        description: `${record.file_name}을(를) 불러왔습니다.`,
      });
    } catch (error) {
      console.error("파일 불러오기 오류:", error);
      toast({
        title: "오류",
        description: "파일을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const deleteUpload = async (record: PdfUploadRecord) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('pdfs')
        .remove([record.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('pdf_uploads')
        .delete()
        .eq('id', record.id);

      if (dbError) throw dbError;

      await fetchUploadHistory();

      toast({
        title: "삭제 완료",
        description: "파일이 삭제되었습니다.",
      });
    } catch (error) {
      console.error("삭제 오류:", error);
      toast({
        title: "오류",
        description: "파일을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") {
        extractTextFromPdf(file);
      } else {
        toast({
          title: "잘못된 파일",
          description: "PDF 파일만 업로드할 수 있습니다.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      extractTextFromPdf(file);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      toast({
        title: "복사 완료",
        description: "텍스트가 클립보드에 복사되었습니다.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "오류",
        description: "클립보드에 복사하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const downloadText = () => {
    const blob = new Blob([extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(".pdf", "")}_extracted.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const analyzeText = async () => {
    if (!extractedText) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setUserAnswers([]);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-text", {
        body: { text: extractedText },
      });

      if (error) throw error;

      setAnalysisResult(data);
      setUserAnswers(new Array(data.questions.length).fill(null));
      toast({
        title: "분석 완료!",
        description: "O/X 퀴즈와 요약이 생성되었습니다.",
      });
    } catch (error) {
      console.error("AI 분석 오류:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "AI 분석 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnswerClick = async (questionIndex: number, answer: boolean) => {
    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = answer;
    setUserAnswers(newAnswers);

    // Check if answer is wrong and save to database
    if (analysisResult && answer !== analysisResult.questions[questionIndex].answer) {
      await saveWrongAnswer({
        questionType: 'ox',
        question: analysisResult.questions[questionIndex].question,
        userAnswer: answer ? 'O' : 'X',
        correctAnswer: analysisResult.questions[questionIndex].answer ? 'O' : 'X',
        explanation: analysisResult.questions[questionIndex].explanation,
      });
    }
  };

  const saveWrongAnswer = async (wrongAnswer: {
    questionType: 'ox' | 'fill_blank' | 'multiple_choice' | 'short_answer';
    question: string;
    userAnswer: string;
    correctAnswer: string;
    explanation?: string;
    hint?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('wrong_answers').insert({
        user_id: user.id,
        pdf_upload_id: currentPdfUploadId,
        question_type: wrongAnswer.questionType,
        question: wrongAnswer.question,
        user_answer: wrongAnswer.userAnswer,
        correct_answer: wrongAnswer.correctAnswer,
        explanation: wrongAnswer.explanation,
        hint: wrongAnswer.hint,
      });

      if (error) throw error;
    } catch (error) {
      console.error('오답 저장 오류:', error);
    }
  };

  const generateFillBlanks = async () => {
    if (!extractedText) return;

    setIsGeneratingBlanks(true);
    setFillBlankResult(null);
    setFillBlankAnswers([]);
    setShowFillBlankAnswers([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-fill-blanks", {
        body: { text: extractedText },
      });

      if (error) throw error;

      setFillBlankResult(data);
      setFillBlankAnswers(new Array(data.questions.length).fill(""));
      setShowFillBlankAnswers(new Array(data.questions.length).fill(false));
      toast({
        title: "생성 완료!",
        description: "빈칸 채우기 문제가 생성되었습니다.",
      });
    } catch (error) {
      console.error("빈칸 문제 생성 오류:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "문제 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBlanks(false);
    }
  };

  const handleFillBlankChange = (questionIndex: number, value: string) => {
    const newAnswers = [...fillBlankAnswers];
    newAnswers[questionIndex] = value;
    setFillBlankAnswers(newAnswers);
  };

  const checkFillBlankAnswer = async (questionIndex: number) => {
    const newShowAnswers = [...showFillBlankAnswers];
    newShowAnswers[questionIndex] = true;
    setShowFillBlankAnswers(newShowAnswers);

    // Check if answer is wrong and save to database
    if (fillBlankResult) {
      const userAnswer = fillBlankAnswers[questionIndex].trim().toLowerCase();
      const correctAnswer = fillBlankResult.questions[questionIndex].answer.trim().toLowerCase();
      
      if (userAnswer !== correctAnswer) {
        await saveWrongAnswer({
          questionType: 'fill_blank',
          question: fillBlankResult.questions[questionIndex].question,
          userAnswer: fillBlankAnswers[questionIndex],
          correctAnswer: fillBlankResult.questions[questionIndex].answer,
          hint: fillBlankResult.questions[questionIndex].hint,
        });
      }
    }
  };

  const generateMultipleChoice = async () => {
    if (!extractedText) return;

    setIsGeneratingMultipleChoice(true);
    setMultipleChoiceResult(null);
    setMultipleChoiceAnswers([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-multiple-choice", {
        body: { text: extractedText },
      });

      if (error) throw error;

      setMultipleChoiceResult(data);
      setMultipleChoiceAnswers(new Array(data.questions.length).fill(null));
      toast({
        title: "생성 완료!",
        description: "객관식 문제가 생성되었습니다.",
      });
    } catch (error) {
      console.error("객관식 문제 생성 오류:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "문제 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingMultipleChoice(false);
    }
  };

  const handleMultipleChoiceAnswer = async (questionIndex: number, selectedOption: number) => {
    const newAnswers = [...multipleChoiceAnswers];
    newAnswers[questionIndex] = selectedOption;
    setMultipleChoiceAnswers(newAnswers);

    // Check if answer is wrong and save to database
    if (multipleChoiceResult && selectedOption !== multipleChoiceResult.questions[questionIndex].correctAnswer) {
      await saveWrongAnswer({
        questionType: 'multiple_choice',
        question: multipleChoiceResult.questions[questionIndex].question,
        userAnswer: multipleChoiceResult.questions[questionIndex].options[selectedOption],
        correctAnswer: multipleChoiceResult.questions[questionIndex].options[multipleChoiceResult.questions[questionIndex].correctAnswer],
        explanation: multipleChoiceResult.questions[questionIndex].explanation,
      });
    }
  };

  const generateShortAnswer = async () => {
    if (!extractedText) return;

    setIsGeneratingShortAnswer(true);
    setShortAnswerResult(null);
    setShortAnswerAnswers([]);
    setShowShortAnswers([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-short-answer", {
        body: { text: extractedText },
      });

      if (error) throw error;

      setShortAnswerResult(data);
      setShortAnswerAnswers(new Array(data.questions.length).fill(""));
      setShowShortAnswers(new Array(data.questions.length).fill(false));
      toast({
        title: "생성 완료!",
        description: "주관식 문제가 생성되었습니다.",
      });
    } catch (error) {
      console.error("주관식 문제 생성 오류:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "문제 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingShortAnswer(false);
    }
  };

  const handleShortAnswerChange = (questionIndex: number, value: string) => {
    const newAnswers = [...shortAnswerAnswers];
    newAnswers[questionIndex] = value;
    setShortAnswerAnswers(newAnswers);
  };

  const checkShortAnswer = async (questionIndex: number) => {
    const newShowAnswers = [...showShortAnswers];
    newShowAnswers[questionIndex] = true;
    setShowShortAnswers(newShowAnswers);

    // Save to wrong answers (user can review their answer)
    if (shortAnswerResult) {
      await saveWrongAnswer({
        questionType: 'short_answer',
        question: shortAnswerResult.questions[questionIndex].question,
        userAnswer: shortAnswerAnswers[questionIndex],
        correctAnswer: shortAnswerResult.questions[questionIndex].answer,
        explanation: shortAnswerResult.questions[questionIndex].explanation,
        hint: shortAnswerResult.questions[questionIndex].keywords.join(', '),
      });
    }
  };

  const solveProblems = async () => {
    if (!extractedText) return;

    setIsSolving(true);
    setSolveResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("solve-problems", {
        body: { text: extractedText },
      });

      if (error) throw error;

      setSolveResult(data);
      toast({
        title: "풀이 완료!",
        description: "AI가 문제를 풀어냈습니다.",
      });
    } catch (error) {
      console.error("문제 풀이 오류:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "문제 풀이 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSolving(false);
    }
  };

  const formatText = (text: string) => {
    return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  };

  const downloadHtml = () => {
    if (!solveResult) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 문제 풀이 결과 - ${fileName.replace('.pdf', '')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #667eea;
      font-size: 2.5em;
      margin-bottom: 10px;
      text-align: center;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 40px;
      font-size: 1.1em;
    }
    .problem-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 30px;
      border-left: 4px solid #667eea;
    }
    .problem-number {
      color: #667eea;
      font-size: 1.5em;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .problem-section {
      margin-bottom: 20px;
    }
    .section-title {
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .problem-text {
      background: white;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
    }
    .solution-text {
      background: #e3f2fd;
      padding: 20px;
      border-radius: 6px;
      border: 1px solid #90caf9;
    }
    .keypoints-text {
      background: #fff3e0;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #ffb74d;
    }
    .footer {
      text-align: center;
      color: #999;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 0.9em;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎓 AI 문제 풀이 결과</h1>
    <div class="subtitle">${fileName.replace('.pdf', '')}</div>
    
    ${solveResult.problems.map((problem, idx) => `
      <div class="problem-card">
        <div class="problem-number">문제 ${idx + 1}</div>
        
        <div class="problem-section">
          <div class="section-title">📝 문제</div>
          <div class="problem-text">${formatText(problem.problem).split('\n').join('<br>')}</div>
        </div>
        
        <div class="problem-section">
          <div class="section-title">💡 해답 및 풀이</div>
          <div class="solution-text">${formatText(problem.solution).split('\n').join('<br>')}</div>
        </div>
        
        ${problem.keyPoints ? `
          <div class="problem-section">
            <div class="section-title">📌 핵심 포인트</div>
            <div class="keypoints-text">${formatText(problem.keyPoints).split('\n').join('<br>')}</div>
          </div>
        ` : ''}
      </div>
    `).join('')}
    
    <div class="footer">
      생성일시: ${new Date().toLocaleString('ko-KR')}<br>
      AI 문제 풀이 시스템
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace('.pdf', '')}_풀이결과.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "다운로드 완료",
      description: "HTML 파일이 다운로드되었습니다.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2 py-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            PDF 텍스트 추출
          </h1>
          <p className="text-lg text-muted-foreground">PDF 파일을 업로드하면 텍스트를 자동으로 추출해드립니다</p>
        </div>

        {uploadHistory.length > 0 && (
          <Card className="p-4">
            <Button
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full gap-2"
            >
              <History className="w-4 h-4" />
              업로드 기록 {showHistory ? "숨기기" : "보기"} ({uploadHistory.length})
            </Button>

            {showHistory && (
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {uploadHistory.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors"
                  >
                    <button
                      onClick={() => loadUploadedPdf(record)}
                      className="flex-1 text-left"
                    >
                      <p className="font-medium truncate">{record.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(record.created_at).toLocaleString('ko-KR')}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteUpload(record)}
                      className="ml-2"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card
          className={`
            p-12 border-2 border-dashed transition-all duration-300
            ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/50"}
            ${isProcessing ? "opacity-50 pointer-events-none" : ""}
          `}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="text-center space-y-4">
            <div className="inline-block p-6 rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
              <Upload className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {isProcessing ? "PDF 처리 중..." : "PDF 파일을 드래그하거나 클릭하세요"}
              </h3>
              <p className="text-muted-foreground">지원 형식: PDF</p>
            </div>
            <label htmlFor="file-upload">
              <Button variant="default" size="lg" className="cursor-pointer" disabled={isProcessing} asChild>
                <span>
                  <FileText className="w-4 h-4 mr-2" />
                  파일 선택
                </span>
              </Button>
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              className="hidden"
              disabled={isProcessing}
            />
          </div>
        </Card>

        {extractedText && (
          <Card className="p-6 flex items-center justify-center gap-4 flex-wrap animate-in fade-in-50 duration-500">
            {mode === 'full' && (
              <>
                <Button variant="default" size="lg" onClick={analyzeText} disabled={isAnalyzing} className="gap-2">
                  <Sparkles className="w-5 h-5" />
                  {isAnalyzing ? "O/X퀴즈 생성 중..." : "O/X퀴즈"}
                </Button>
                <Button variant="secondary" size="lg" onClick={generateFillBlanks} disabled={isGeneratingBlanks} className="gap-2">
                  <PenLine className="w-5 h-5" />
                  {isGeneratingBlanks ? "빈칸 문제 생성 중..." : "빈칸 문제"}
                </Button>
                <Button variant="outline" size="lg" onClick={generateMultipleChoice} disabled={isGeneratingMultipleChoice} className="gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  {isGeneratingMultipleChoice ? "객관식 생성 중..." : "객관식 문제"}
                </Button>
                <Button variant="ghost" size="lg" onClick={generateShortAnswer} disabled={isGeneratingShortAnswer} className="gap-2">
                  <FileText className="w-5 h-5" />
                  {isGeneratingShortAnswer ? "주관식 생성 중..." : "주관식 문제"}
                </Button>
              </>
            )}
            {mode === 'solve-only' && (
              <Button variant="outline" size="lg" onClick={solveProblems} disabled={isSolving} className="gap-2">
                <Brain className="w-5 h-5" />
                {isSolving ? "AI 풀이 중..." : "AI 문제 풀이"}
              </Button>
            )}
          </Card>
        )}

        {analysisResult && (
          <div className="space-y-6 animate-in fade-in-50 duration-500">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">AI 요약</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed p-4 bg-muted rounded-lg">{analysisResult.summary}</p>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">O/X 퀴즈</h3>
              </div>
              <div className="space-y-4">
                {analysisResult.questions.map((q, idx) => {
                  const userAnswer = userAnswers[idx];
                  const isAnswered = userAnswer !== null;
                  const isCorrect = isAnswered && userAnswer === q.answer;

                  return (
                    <div
                      key={idx}
                      className={`p-4 border rounded-lg transition-all ${
                        isAnswered
                          ? isCorrect
                            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                            : "border-red-500 bg-red-50 dark:bg-red-950/20"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-primary">{idx + 1}.</span>
                          <p className="flex-1 font-medium">{q.question}</p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant={userAnswer === true ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleAnswerClick(idx, true)}
                            disabled={isAnswered}
                            className="flex-1"
                          >
                            O
                          </Button>
                          <Button
                            variant={userAnswer === false ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleAnswerClick(idx, false)}
                            disabled={isAnswered}
                            className="flex-1"
                          >
                            X
                          </Button>
                        </div>

                        {isAnswered && (
                          <div className="space-y-2 mt-3 pt-3 border-t">
                            <div className="flex items-center gap-2">
                              {isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  <span className="font-semibold text-green-600">정답입니다!</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-5 h-5 text-red-600" />
                                  <span className="font-semibold text-red-600">
                                    오답입니다. 정답: {q.answer ? "O" : "X"}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground bg-background/50 p-3 rounded">
                              <span className="font-semibold">해설:</span> {q.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {fillBlankResult && (
          <Card className="p-6 space-y-4 animate-in fade-in-50 duration-500">
            <div className="flex items-center gap-2 mb-4">
              <PenLine className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">빈칸 채우기 문제</h3>
            </div>
            <div className="space-y-4">
              {fillBlankResult.questions.map((q, idx) => {
                const userAnswer = fillBlankAnswers[idx];
                const isAnswered = showFillBlankAnswers[idx];
                const isCorrect = isAnswered && userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();

                return (
                  <div
                    key={idx}
                    className={`p-4 border rounded-lg transition-all ${
                      isAnswered
                        ? isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-red-500 bg-red-50 dark:bg-red-950/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-primary">{idx + 1}.</span>
                        <p className="flex-1 font-medium whitespace-pre-wrap">{q.question}</p>
                      </div>

                      <div className="space-y-2">
                        <Input
                          value={userAnswer}
                          onChange={(e) => handleFillBlankChange(idx, e.target.value)}
                          placeholder="답을 입력하세요"
                          disabled={isAnswered}
                          className="w-full"
                        />
                        {!isAnswered && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkFillBlankAnswer(idx)}
                            disabled={!userAnswer.trim()}
                            className="w-full"
                          >
                            정답 확인
                          </Button>
                        )}
                      </div>

                      {isAnswered && (
                        <div className="space-y-2 mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            {isCorrect ? (
                              <>
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                <span className="font-semibold text-green-600">정답입니다!</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="font-semibold text-red-600">
                                  오답입니다. 정답: {q.answer}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">💡 힌트</p>
                            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">{q.hint}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {multipleChoiceResult && (
          <Card className="p-6 space-y-4 animate-in fade-in-50 duration-500">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">객관식 문제</h3>
            </div>
            <div className="space-y-4">
              {multipleChoiceResult.questions.map((q, idx) => {
                const userAnswer = multipleChoiceAnswers[idx];
                const isAnswered = userAnswer !== null;
                const isCorrect = isAnswered && userAnswer === q.correctAnswer;

                return (
                  <div
                    key={idx}
                    className={`p-4 border rounded-lg transition-all ${
                      isAnswered
                        ? isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-red-500 bg-red-50 dark:bg-red-950/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-primary">{idx + 1}.</span>
                        <div className="flex-1">
                          <LatexRenderer text={q.question} />
                        </div>
                      </div>

                      <div className="space-y-2 ml-6">
                        {q.options.map((option, optionIdx) => (
                          <Button
                            key={optionIdx}
                            variant={userAnswer === optionIdx ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleMultipleChoiceAnswer(idx, optionIdx)}
                            disabled={isAnswered}
                            className={`w-full justify-start text-left h-auto py-3 ${
                              isAnswered && optionIdx === q.correctAnswer
                                ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                                : ""
                            }`}
                          >
                            <span className="font-semibold mr-2">{optionIdx + 1}.</span>
                            <span className="flex-1">
                              <LatexRenderer text={option} />
                            </span>
                          </Button>
                        ))}
                      </div>

                      {isAnswered && (
                        <div className="space-y-2 mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            {isCorrect ? (
                              <>
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                <span className="font-semibold text-green-600">정답입니다!</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="font-semibold text-red-600">
                                  오답입니다. 정답: {q.correctAnswer + 1}번
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground bg-background/50 p-3 rounded">
                            <span className="font-semibold">해설:</span>{" "}
                            <LatexRenderer text={q.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {shortAnswerResult && (
          <Card className="p-6 space-y-4 animate-in fade-in-50 duration-500">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">주관식 문제</h3>
            </div>
            <div className="space-y-4">
              {shortAnswerResult.questions.map((q, idx) => {
                const userAnswer = shortAnswerAnswers[idx];
                const isAnswered = showShortAnswers[idx];

                return (
                  <div
                    key={idx}
                    className={`p-4 border rounded-lg transition-all ${
                      isAnswered
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-primary">{idx + 1}.</span>
                        <div className="flex-1">
                          <LatexRenderer text={q.question} />
                        </div>
                      </div>

                      <div className="space-y-2 ml-6">
                        <textarea
                          value={userAnswer}
                          onChange={(e) => handleShortAnswerChange(idx, e.target.value)}
                          placeholder="답변을 작성하세요 (최소 2-3문장)"
                          disabled={isAnswered}
                          className="w-full min-h-[100px] p-3 border rounded-md resize-y"
                          rows={4}
                        />
                        {!isAnswered && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkShortAnswer(idx)}
                            disabled={!userAnswer.trim()}
                            className="w-full"
                          >
                            답안 확인
                          </Button>
                        )}
                      </div>

                      {isAnswered && (
                        <div className="space-y-3 mt-3 pt-3 border-t">
                          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="font-medium text-sm text-green-600 dark:text-green-400 mb-2">
                              ✅ 모범 답안
                            </p>
                            <div className="text-sm">
                              <LatexRenderer text={q.answer} />
                            </div>
                          </div>

                          <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                            <p className="font-medium text-sm text-amber-900 dark:text-amber-100 mb-2">
                              🔑 핵심 키워드
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {q.keywords.map((keyword, kidx) => (
                                <span key={kidx} className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded text-sm">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                            <p className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">
                              📖 해설
                            </p>
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                              <LatexRenderer text={q.explanation} />
                            </div>
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                            <p className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                              ✍️ 내 답변
                            </p>
                            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                              {userAnswer}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {solveResult && (
          <Card className="p-6 space-y-4 animate-in fade-in-50 duration-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">AI 문제 풀이</h3>
              </div>
              <Button variant="outline" size="sm" onClick={downloadHtml} className="gap-2">
                <FileDown className="w-4 h-4" />
                HTML 다운로드
              </Button>
            </div>
            <div className="space-y-6">
              {solveResult.problems.map((problem, idx) => (
                <div
                  key={idx}
                  className="p-4 border border-border rounded-lg hover:border-primary/50 transition-all"
                >
                  <div className="space-y-4">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-primary">{idx + 1}.</span>
                      <div className="flex-1 space-y-3">
                        <div className="bg-muted p-3 rounded">
                          <p className="font-medium text-sm text-muted-foreground mb-1">문제</p>
                          <div className="font-medium">
                            <LatexRenderer text={formatText(problem.problem)} />
                          </div>
                        </div>
                        
                        <div className="bg-primary/5 p-4 rounded">
                          <p className="font-medium text-sm text-primary mb-3">💡 해답 및 풀이</p>
                          <div className="prose prose-sm max-w-none">
                            <div className="leading-loose text-base">
                              <LatexRenderer text={formatText(problem.solution)} />
                            </div>
                          </div>
                        </div>
                        
                        {problem.keyPoints && (
                          <div className="bg-accent/10 p-3 rounded">
                            <p className="font-medium text-sm text-accent-foreground mb-2">📌 핵심 포인트</p>
                            <div className="text-sm leading-relaxed">
                              <LatexRenderer text={formatText(problem.keyPoints)} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
