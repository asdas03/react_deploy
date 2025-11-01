-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  school TEXT NOT NULL,
  student_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Create pdf_uploads table
CREATE TABLE public.pdf_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pdf_uploads
ALTER TABLE public.pdf_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies for pdf_uploads
CREATE POLICY "Users can view their own uploads"
ON public.pdf_uploads FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own uploads"
ON public.pdf_uploads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
ON public.pdf_uploads FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads"
ON public.pdf_uploads FOR DELETE
USING (auth.uid() = user_id);

-- Create wrong_answers table
CREATE TABLE public.wrong_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pdf_upload_id UUID REFERENCES public.pdf_uploads(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  hint TEXT,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on wrong_answers
ALTER TABLE public.wrong_answers ENABLE ROW LEVEL SECURITY;

-- Create policies for wrong_answers
CREATE POLICY "Users can view their own wrong answers"
ON public.wrong_answers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wrong answers"
ON public.wrong_answers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wrong answers"
ON public.wrong_answers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wrong answers"
ON public.wrong_answers FOR DELETE
USING (auth.uid() = user_id);

-- Create bookmarked_problems table
CREATE TABLE public.bookmarked_problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pdf_upload_id UUID REFERENCES public.pdf_uploads(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bookmarked_problems
ALTER TABLE public.bookmarked_problems ENABLE ROW LEVEL SECURITY;

-- Create policies for bookmarked_problems
CREATE POLICY "Users can view their own bookmarked problems"
ON public.bookmarked_problems FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarked problems"
ON public.bookmarked_problems FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookmarked problems"
ON public.bookmarked_problems FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarked problems"
ON public.bookmarked_problems FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pdf_uploads_updated_at
BEFORE UPDATE ON public.pdf_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wrong_answers_updated_at
BEFORE UPDATE ON public.wrong_answers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookmarked_problems_updated_at
BEFORE UPDATE ON public.bookmarked_problems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();