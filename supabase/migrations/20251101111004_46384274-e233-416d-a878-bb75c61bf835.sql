-- Create table for wrong answers notebook
CREATE TABLE public.wrong_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pdf_upload_id UUID REFERENCES public.pdf_uploads(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('ox', 'fill_blank')),
  question TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.wrong_answers ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own wrong answers"
ON public.wrong_answers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wrong answers"
ON public.wrong_answers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wrong answers"
ON public.wrong_answers
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_wrong_answers_updated_at
BEFORE UPDATE ON public.wrong_answers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_wrong_answers_user_id ON public.wrong_answers(user_id);
CREATE INDEX idx_wrong_answers_pdf_upload_id ON public.wrong_answers(pdf_upload_id);