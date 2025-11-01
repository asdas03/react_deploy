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
    const { weaknesses, pdfText } = await req.json();

    if (!weaknesses || !Array.isArray(weaknesses)) {
      throw new Error('약점 데이터가 제공되지 않았습니다');
    }

    if (!pdfText || typeof pdfText !== 'string') {
      throw new Error('PDF 텍스트가 제공되지 않았습니다');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY가 설정되지 않았습니다');
    }

    console.log('추천 문제 생성 시작...');

    const weaknessesDescription = weaknesses
      .map((w: any) => `- ${w.category} (오답률: ${w.errorRate.toFixed(1)}%)`)
      .join('\n');

    const systemPrompt = "당신은 학습 문제를 생성하는 AI 튜터입니다. 학생의 약점을 분석한 결과를 바탕으로, 제공된 PDF 텍스트 범위 내에서 맞춤 문제를 생성하세요.\n\nCRITICAL: 응답은 반드시 순수 JSON 형식으로만 반환하세요. markdown code block으로 감싸지 마세요.\n\n응답 형식:\n{\n  \"problems\": [\n    {\n      \"problem\": \"문제 내용 (Markdown 형식)\",\n      \"category\": \"문제 카테고리 (약점 카테고리와 일치)\",\n      \"difficulty\": \"난이도 (쉬움/보통/어려움)\",\n      \"hint\": \"문제 풀이를 위한 힌트 (Markdown 형식)\",\n      \"answer\": \"정답 (Markdown 형식)\",\n      \"explanation\": \"상세한 해설 및 풀이 과정 (Markdown 형식)\"\n    }\n  ]\n}\n\n문제 생성 기준:\n1. 학생의 약점 영역에 집중하여 문제를 생성하세요\n2. PDF 텍스트에서 관련 내용을 찾아 문제로 만드세요\n3. 각 약점 카테고리당 2-3개의 문제를 생성하세요\n4. 문제는 점진적으로 난이도를 높여가세요\n5. 각 문제에 학습에 도움이 되는 힌트를 포함하세요\n6. 정답과 함께 상세한 풀이 과정을 포함하세요\n7. 총 5-8개의 문제를 생성하세요\n8. Markdown 형식을 사용하여 구조화된 내용을 작성하세요 (제목, 목록, 강조 등)\n9. 수학 수식은 LaTeX 형식으로 작성하세요 ($...$ 또는 $$...$$)";

    const userPrompt = `학생의 약점:
${weaknessesDescription}

PDF 내용:
${pdfText.substring(0, 3000)}

위 내용을 바탕으로 학생의 약점을 보완할 수 있는 문제를 생성해주세요.`;

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
          { role: 'user', content: userPrompt }
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
      throw new Error('AI 문제 생성 중 오류가 발생했습니다');
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
        problems: [{
          problem: content,
          category: weaknesses[0]?.category || '일반',
          difficulty: '보통',
          hint: 'PDF 내용을 다시 검토해보세요.',
          answer: '답변을 확인할 수 없습니다.',
          explanation: 'PDF 내용을 참고하여 답을 도출해보세요.'
        }]
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('문제 생성 오류:', error);
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
