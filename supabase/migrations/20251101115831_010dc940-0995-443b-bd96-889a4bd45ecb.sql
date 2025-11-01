-- Add 'short_answer' to the question_type check constraint
ALTER TABLE wrong_answers 
DROP CONSTRAINT IF EXISTS wrong_answers_question_type_check;

ALTER TABLE wrong_answers
ADD CONSTRAINT wrong_answers_question_type_check 
CHECK (question_type IN ('ox', 'fill_blank', 'multiple_choice', 'short_answer'));