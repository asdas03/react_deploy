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

    if (!text || typeof text !== 'string') {
      throw new Error('텍스트가 제공되지 않았습니다');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY가 설정되지 않았습니다');
    }

    console.log('AI로 문제 풀이 시작...');

    const systemPrompt = `당신은 학습 문제를 풀어주는 AI 튜터입니다. 
제공된 텍스트에서 문제를 찾아내고, 각 문제에 대한 상세한 해답과 풀이 과정을 제공하세요.

응답 형식:
{
  "problems": [
    {
      "problem": "인식된 문제 내용",
      "solution": "상세한 해답과 풀이 과정",
      "keyPoints": "핵심 포인트나 추가 설명"
    }
  ]
}

- 문제가 명확하지 않으면 텍스트의 내용을 바탕으로 학습할 수 있는 핵심 개념을 문제로 만들어 풀이하세요.
- 각 문제에 대해 단계별로 상세히 설명하세요.
- 수학 문제의 경우 계산 과정을 명확히 보여주세요.
- 이론 문제의 경우 개념 설명과 함께 답변하세요.`;

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
          { role: 'user', content: `다음 텍스트에서 문제를 찾아 풀어주세요:\n\n${text}` }
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

    // JSON 파싱 시도
    let result;
    try {
      // 마크다운 코드 블록 제거
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      // JSON 파싱 실패 시 텍스트 그대로 반환
      result = {
        problems: [{
          problem: '분석된 내용',
          solution: content,
          keyPoints: '자세한 내용은 위의 해답을 참고하세요.'
        }]
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('문제 풀이 오류:', error);
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
