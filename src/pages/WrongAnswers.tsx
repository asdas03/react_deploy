import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, Trash2, BookOpen, CheckCircle, PenLine, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LatexRenderer } from '@/components/LatexRenderer';

interface WrongAnswer {
  id: string;
  question_type: 'ox' | 'fill_blank' | 'multiple_choice' | 'short_answer';
  question: string;
  user_answer: string;
  correct_answer: string;
  explanation?: string;
  hint?: string;
  created_at: string;
  pdf_upload_id: string | null;
  pdf_uploads?: {
    file_name: string;
  };
}

interface PdfGroup {
  pdf_upload_id: string | null;
  file_name: string;
  count: number;
}

type QuestionType = 'ox' | 'fill_blank' | 'multiple_choice' | 'short_answer' | null;

const WrongAnswers = () => {
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<QuestionType>(null);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [pdfGroups, setPdfGroups] = useState<PdfGroup[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  useEffect(() => {
    if (selectedType) {
      fetchPdfGroups();
    }
  }, [selectedType]);

  useEffect(() => {
    if (selectedType && selectedPdfId !== null) {
      fetchWrongAnswers();
    }
  }, [selectedType, selectedPdfId]);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setLoading(false);
  };

  const fetchPdfGroups = async () => {
    if (!selectedType) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wrong_answers')
        .select(`
          pdf_upload_id,
          pdf_uploads (
            file_name
          )
        `)
        .eq('question_type', selectedType);

      if (error) throw error;

      // Group by PDF and count
      const groups = (data || []).reduce((acc: PdfGroup[], item: any) => {
        const pdfId = item.pdf_upload_id;
        const fileName = item.pdf_uploads?.file_name || '출처 없음';
        
        const existing = acc.find(g => g.pdf_upload_id === pdfId);
        if (existing) {
          existing.count++;
        } else {
          acc.push({
            pdf_upload_id: pdfId,
            file_name: fileName,
            count: 1,
          });
        }
        return acc;
      }, []);

      setPdfGroups(groups);
    } catch (error) {
      console.error('PDF 목록 불러오기 오류:', error);
      toast({
        title: '오류',
        description: 'PDF 목록을 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWrongAnswers = async () => {
    if (!selectedType || selectedPdfId === null) return;

    try {
      setLoading(true);
      let query = supabase
        .from('wrong_answers')
        .select(`
          *,
          pdf_uploads (
            file_name
          )
        `)
        .eq('question_type', selectedType)
        .order('created_at', { ascending: false });

      // Filter by PDF ID (including null for '출처 없음')
      if (selectedPdfId === 'null') {
        query = query.is('pdf_upload_id', null);
      } else {
        query = query.eq('pdf_upload_id', selectedPdfId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setWrongAnswers((data || []) as WrongAnswer[]);
    } catch (error) {
      console.error('오답 불러오기 오류:', error);
      toast({
        title: '오류',
        description: '오답을 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (selectedPdfId !== null) {
      setSelectedPdfId(null);
      setWrongAnswers([]);
    } else if (selectedType) {
      setSelectedType(null);
      setPdfGroups([]);
    } else {
      navigate('/');
    }
  };

  const deleteWrongAnswer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('wrong_answers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWrongAnswers(wrongAnswers.filter(wa => wa.id !== id));
      
      // Refresh PDF groups count
      if (wrongAnswers.length === 1) {
        // If this was the last question, go back
        handleBack();
      } else {
        // Update the count in pdfGroups
        fetchPdfGroups();
      }

      toast({
        title: '삭제 완료',
        description: '오답이 삭제되었습니다.',
      });
    } catch (error) {
      console.error('삭제 오류:', error);
      toast({
        title: '오류',
        description: '오답을 삭제하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  if (loading && !selectedType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30">
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-start mb-6">
          <Button
            variant="outline"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {selectedPdfId ? 'PDF 목록으로' : selectedType ? '문제 유형 선택으로' : '메뉴로 돌아가기'}
          </Button>
        </div>

        <div className="text-center space-y-2 py-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            오답노트
          </h1>
          <p className="text-lg text-muted-foreground">
            {selectedPdfId ? '틀린 문제를 다시 복습해보세요' : selectedType ? 'PDF를 선택하세요' : '문제 유형을 선택하세요'}
          </p>
        </div>

        {/* Question Type Selection */}
        {!selectedType && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            <Card 
              className="p-8 hover:shadow-lg transition-all cursor-pointer hover:scale-105"
              onClick={() => setSelectedType('ox')}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold">O/X 퀴즈</h3>
                <p className="text-muted-foreground">O/X 문제에서 틀린 문제들을 복습합니다</p>
              </div>
            </Card>

            <Card 
              className="p-8 hover:shadow-lg transition-all cursor-pointer hover:scale-105"
              onClick={() => setSelectedType('fill_blank')}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <PenLine className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold">빈칸 채우기</h3>
                <p className="text-muted-foreground">빈칸 문제에서 틀린 문제들을 복습합니다</p>
              </div>
            </Card>

            <Card 
              className="p-8 hover:shadow-lg transition-all cursor-pointer hover:scale-105"
              onClick={() => setSelectedType('multiple_choice')}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold">객관식</h3>
                <p className="text-muted-foreground">객관식 문제에서 틀린 문제들을 복습합니다</p>
              </div>
            </Card>

            <Card 
              className="p-8 hover:shadow-lg transition-all cursor-pointer hover:scale-105"
              onClick={() => setSelectedType('short_answer')}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold">주관식</h3>
                <p className="text-muted-foreground">주관식 문제에서 작성한 답변들을 복습합니다</p>
              </div>
            </Card>
          </div>
        )}

        {/* PDF List */}
        {selectedType && !selectedPdfId && (
          <div className="max-w-4xl mx-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pdfGroups.length === 0 ? (
              <Card className="p-12 text-center">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">저장된 오답이 없습니다</h3>
                <p className="text-muted-foreground">
                  {selectedType === 'ox' ? 'O/X 퀴즈' : selectedType === 'fill_blank' ? '빈칸 채우기' : selectedType === 'multiple_choice' ? '객관식' : '주관식'} 문제를 풀고 틀린 문제가 자동으로 저장됩니다
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {pdfGroups.map((group) => (
                  <Card 
                    key={group.pdf_upload_id || 'null'}
                    className="p-6 hover:shadow-lg transition-all cursor-pointer hover:border-primary"
                    onClick={() => setSelectedPdfId(group.pdf_upload_id || 'null')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{group.file_name}</h3>
                          <p className="text-sm text-muted-foreground">틀린 문제 {group.count}개</p>
                        </div>
                      </div>
                      <ArrowLeft className="w-5 h-5 rotate-180 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Wrong Answers List */}
        {selectedType && selectedPdfId && (
          <div className="max-w-4xl mx-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : wrongAnswers.length === 0 ? (
              <Card className="p-12 text-center">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">저장된 오답이 없습니다</h3>
                <p className="text-muted-foreground">문제를 풀고 틀린 문제가 자동으로 저장됩니다</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {wrongAnswers.map((wrongAnswer) => (
                  <Card key={wrongAnswer.id} className="p-6 animate-in fade-in-50 duration-500">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            wrongAnswer.question_type === 'ox' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                              : wrongAnswer.question_type === 'fill_blank'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100'
                              : wrongAnswer.question_type === 'multiple_choice'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100'
                          }`}>
                            {wrongAnswer.question_type === 'ox' ? 'O/X 퀴즈' : wrongAnswer.question_type === 'fill_blank' ? '빈칸 채우기' : wrongAnswer.question_type === 'multiple_choice' ? '객관식' : '주관식'}
                          </span>
                          {wrongAnswer.pdf_uploads?.file_name && (
                            <span className="text-xs text-muted-foreground">
                              출처: {wrongAnswer.pdf_uploads.file_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(wrongAnswer.created_at).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWrongAnswer(wrongAnswer.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="font-medium text-sm text-muted-foreground mb-2">문제</p>
                        <div className="font-medium">
                          <LatexRenderer text={wrongAnswer.question} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                          <p className="font-medium text-sm text-red-600 dark:text-red-400 mb-2">
                            ❌ 내 답변
                          </p>
                          <div className="font-medium">
                            <LatexRenderer text={wrongAnswer.user_answer} />
                          </div>
                        </div>

                        <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="font-medium text-sm text-green-600 dark:text-green-400 mb-2">
                            ✅ 정답
                          </p>
                          <div className="font-medium">
                            <LatexRenderer text={wrongAnswer.correct_answer} />
                          </div>
                        </div>
                      </div>

                      {wrongAnswer.explanation && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                          <p className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">
                            📖 해설
                          </p>
                          <div className="text-sm text-blue-800 dark:text-blue-200">
                            <LatexRenderer text={wrongAnswer.explanation} />
                          </div>
                        </div>
                      )}

                      {wrongAnswer.hint && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                          <p className="font-medium text-sm text-amber-900 dark:text-amber-100 mb-2">
                            💡 힌트
                          </p>
                          <div className="text-sm text-amber-800 dark:text-amber-200">
                            <LatexRenderer text={wrongAnswer.hint} />
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WrongAnswers;
