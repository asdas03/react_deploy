-- Create bookmarked_problems table
CREATE TABLE public.bookmarked_problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pdf_upload_id UUID REFERENCES public.pdf_uploads(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[],
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bookmarked_problems ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own bookmarks" 
ON public.bookmarked_problems 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookmarks" 
ON public.bookmarked_problems 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" 
ON public.bookmarked_problems 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookmarks" 
ON public.bookmarked_problems 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bookmarked_problems_updated_at
BEFORE UPDATE ON public.bookmarked_problems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();