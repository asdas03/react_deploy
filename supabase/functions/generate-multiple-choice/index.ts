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

    const systemPrompt = "당신은 한국어 교육 전문가입니다. 주어진 텍스트를 분석하여 객관식 문제를 생성합니다.";

    const tools = [{
      type: "function",
      function: {
        name: "generate_multiple_choice",
        description: "객관식 문제를 생성합니다",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              description: `${questionCount}개의 객관식 문제 배열`,
              items: {
                type: "object",
                properties: {
                  question: {
                    type: "string",
                    description: "문제 내용 (Markdown 형식, LaTeX 지원)"
                  },
                  options: {
                    type: "array",
                    description: "4개의 선택지",
                    items: { type: "string" }
                  },
                  correctAnswer: {
                    type: "number",
                    description: "정답 선택지의 인덱스 (0-3)"
                  },
                  explanation: {
                    type: "string",
                    description: "정답에 대한 자세한 설명 (Markdown 형식)"
                  }
                },
                required: ["question", "options", "correctAnswer", "explanation"]
              }
            }
          },
          required: ["questions"]
        }
      }
    }];

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
          { role: 'user', content: `다음 텍스트를 바탕으로 ${questionCount}개의 객관식 문제를 생성해주세요. 각 문제는 4개의 선택지를 가지며, Markdown과 LaTeX 형식을 사용할 수 있습니다:\n\n${text}` }
        ],
        tools: tools,
        tool_choice: { type: "function", function: { name: "generate_multiple_choice" } }
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
    
    // Extract function call result
    const toolCall = aiResponse.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('AI가 함수 호출을 반환하지 않았습니다');
    }

    const result = JSON.parse(toolCall.function.arguments);

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
