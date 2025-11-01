import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text) {
      throw new Error('텍스트가 제공되지 않았습니다');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `당신은 한국어 교육 전문가입니다. 주어진 텍스트를 분석하여 객관식 문제를 생성합니다.

다음 JSON 형식으로 5개의 객관식 문제를 생성하세요:
{
  "questions": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctAnswer": 0,
      "explanation": "정답 설명"
    }
  ]
}

규칙:
1. 각 문제는 명확하고 구체적이어야 함
2. 4개의 선택지를 제공하며, 하나만 정답
3. correctAnswer는 정답 선택지의 인덱스 (0-3)
4. 선택지는 적절히 혼란스럽되 명확히 구분되어야 함
5. explanation에는 정답에 대한 자세한 설명 포함
6. 수학 공식이나 기호는 LaTeX 형식으로 작성 (예: $x^2$, $$\\frac{a}{b}$$)
7. 반드시 유효한 JSON만 반환`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `다음 텍스트를 바탕으로 객관식 문제를 생성해주세요:\n\n${text}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      }
      if (response.status === 402) {
        throw new Error('AI 크레딧이 부족합니다. Lovable 워크스페이스에서 크레딧을 추가해주세요.');
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI 요청 처리 중 오류가 발생했습니다');
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;

    // Extract JSON from markdown code blocks if present
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    // Clean up potential JSON issues
    jsonContent = jsonContent.trim();
    
    let result;
    try {
      result = JSON.parse(jsonContent);
    } catch (parseError) {
      // If parsing fails, try to fix common issues with escaped characters
      console.error('Initial JSON parse failed:', parseError);
      console.log('Attempting to clean JSON content...');
      
      // Try to parse with a more lenient approach
      try {
        // Replace problematic escape sequences
        const cleanedContent = jsonContent
          .replace(/\\/g, '\\\\')  // Escape backslashes
          .replace(/\\\\n/g, '\\n')  // Fix over-escaped newlines
          .replace(/\\\\t/g, '\\t')  // Fix over-escaped tabs
          .replace(/\\\\"/g, '\\"');  // Fix over-escaped quotes
        
        result = JSON.parse(cleanedContent);
      } catch (secondError) {
        console.error('Second parse attempt failed:', secondError);
        console.log('Raw content:', jsonContent);
        throw new Error('JSON 파싱에 실패했습니다. AI 응답 형식을 확인해주세요.');
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-multiple-choice function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
