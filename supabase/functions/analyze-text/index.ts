import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, questionCount = 5 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "텍스트가 비어있습니다" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (![5, 10, 15].includes(questionCount)) {
      return new Response(JSON.stringify({ error: "문제 수는 5, 10, 15개 중 하나여야 합니다" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "당신은 교육 콘텐츠 전문가입니다. 주어진 텍스트를 분석하여 O/X 퀴즈와 요약을 생성합니다.",
          },
          {
            role: "user",
            content: `다음 텍스트를 분석하여:\n1. ${questionCount}개의 O/X 퀴즈 문제를 만들어주세요\n2. 핵심 내용을 3-5문장으로 요약해주세요\n\n텍스트:\n${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_quiz_and_summary",
              description: "O/X 퀴즈와 요약을 생성합니다",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "O/X 문제" },
                        answer: { type: "boolean", description: "정답 (true=O, false=X)" },
                        explanation: { type: "string", description: "해설" },
                      },
                      required: ["question", "answer", "explanation"],
                      additionalProperties: false,
                    },
                    minItems: questionCount,
                    maxItems: questionCount,
                  },
                  summary: {
                    type: "string",
                    description: "핵심 내용 요약",
                  },
                },
                required: ["questions", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_quiz_and_summary" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "크레딧이 부족합니다. 워크스페이스에 크레딧을 추가해주세요." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI 분석 중 오류가 발생했습니다" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI 응답에서 결과를 찾을 수 없습니다");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-text error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "알 수 없는 오류" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
