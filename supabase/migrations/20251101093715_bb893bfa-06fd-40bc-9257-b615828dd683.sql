-- Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pdfs', 'pdfs', false);

-- Create table for PDF upload history
CREATE TABLE public.pdf_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pdf_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies for pdf_uploads
CREATE POLICY "Users can view their own uploads"
ON public.pdf_uploads
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own uploads"
ON public.pdf_uploads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
ON public.pdf_uploads
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads"
ON public.pdf_uploads
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pdf_uploads_updated_at
BEFORE UPDATE ON public.pdf_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for PDF files
CREATE POLICY "Users can view their own PDFs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own PDFs"
ON storage.objects
FOR DELETE
USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);