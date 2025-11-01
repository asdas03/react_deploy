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
    const { wrongAnswers } = await req.json();

    if (!wrongAnswers || !Array.isArray(wrongAnswers)) {
      throw new Error('오답 데이터가 제공되지 않았습니다');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY가 설정되지 않았습니다');
    }

    console.log('약점 분석 시작...');

    const systemPrompt = "당신은 학습 데이터를 분석하는 AI 분석가입니다. 학생이 틀린 문제들을 분석하여 약점 영역을 파악하세요.\n\nCRITICAL: 응답은 반드시 순수 JSON 형식으로만 반환하세요. markdown code block으로 감싸지 마세요.\n\n응답 형식:\n{\n  \"weaknesses\": [\n    {\n      \"category\": \"약점 카테고리명 (예: 연산, 문법, 독해 등)\",\n      \"errorCount\": 해당 카테고리의 오답 개수,\n      \"errorRate\": 오답률 (백분율),\n      \"examples\": [\"오답 예시 1\", \"오답 예시 2\"]\n    }\n  ]\n}\n\n분석 기준:\n1. 문제 유형과 내용을 기반으로 카테고리를 자동으로 분류하세요\n2. 가장 많이 틀린 카테고리 순으로 정렬하세요\n3. 각 카테고리별로 대표적인 오답 예시 2-3개를 포함하세요\n4. 오답률은 전체 문제 대비 해당 카테고리의 비율로 계산하세요";

    const wrongAnswersText = wrongAnswers.map((wa: any, index: number) => 
      `문제 ${index + 1}: ${wa.question} (유형: ${wa.question_type})`
    ).join('\n');

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
          { role: 'user', content: `다음 오답들을 분석하여 약점을 파악해주세요:\n\n${wrongAnswersText}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      }
      if (response.status === 402) {
        throw new Error('크레딧이 부족합니다. Lovable AI 워크스페이스에 크레딧을 추가해주세요.');
      }
      const errorText = await response.text();
      console.error('AI gateway 오류:', response.status, errorText);
      throw new Error('AI 분석 중 오류가 발생했습니다');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log('AI 응답:', content);

    let result;
    try {
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      result = {
        weaknesses: [{
          category: '일반',
          errorCount: wrongAnswers.length,
          errorRate: 100,
          examples: wrongAnswers.slice(0, 3).map((wa: any) => wa.question)
        }]
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('약점 분석 오류:', error);
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
