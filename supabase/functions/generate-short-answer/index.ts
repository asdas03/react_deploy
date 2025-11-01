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
    const { text, questionCount = 5 } = await req.json();
    
    if (!text) {
      throw new Error('텍스트가 제공되지 않았습니다');
    }

    if (![5, 10, 15].includes(questionCount)) {
      throw new Error('문제 수는 5, 10, 15개 중 하나여야 합니다');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `당신은 한국어 교육 전문가입니다. 주어진 텍스트를 분석하여 ${questionCount}개의 주관식 문제를 생성합니다.

규칙:
1. 각 문제는 깊이 있는 이해를 요구해야 함
2. 모범 답안은 2-3문장으로 구체적으로 작성
3. keywords에는 답안에 반드시 포함되어야 할 핵심 개념 3-5개
4. explanation에는 왜 이것이 중요한지, 어떤 맥락에서 이해해야 하는지 설명
5. Markdown 형식을 사용하여 구조화된 내용을 작성하세요 (제목, 목록, 강조 등)
6. 수학 공식이나 기호는 LaTeX 형식으로 작성 (예: $x^2$, $$a/b$$)`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `다음 텍스트를 바탕으로 주관식 문제를 생성해주세요:\n\n${text}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_short_answer",
              description: `${questionCount}개의 주관식 문제를 생성합니다.`,
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "문제 내용 (Markdown 형식)" },
                        answer: { type: "string", description: "모범 답안 (Markdown 형식)" },
                        keywords: { 
                          type: "array", 
                          items: { type: "string" },
                          description: "핵심 키워드 3-5개"
                        },
                        explanation: { type: "string", description: "답안 설명 (Markdown 형식)" }
                      },
                      required: ["question", "answer", "keywords", "explanation"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["questions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_short_answer" } }
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
    console.log('AI response:', JSON.stringify(aiResponse));
    
    // Extract structured output from tool call
    const toolCall = aiResponse.choices[0].message.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'generate_short_answer') {
      throw new Error('AI가 올바른 형식으로 응답하지 않았습니다');
    }
    
    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-short-answer function:', error);
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
