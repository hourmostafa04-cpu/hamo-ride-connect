import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  EMPTY_AI_ORDER,
  ORDER_JSON_SCHEMA,
  ORDER_SYSTEM_PROMPT,
  type AiOrderResult,
} from "./ai-order-schema";

const schema = z.object({ text: z.string().min(2).max(2000) });

/** Parse a spoken Darija order/identity sentence into structured fields with the Lovable AI gateway. */
export const parseOrderWithAI = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { result: null as AiOrderResult | null, error: "missing_key" as const };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        messages: [
          { role: "system", content: ORDER_SYSTEM_PROMPT },
          { role: "user", content: data.text },
        ],
        response_format: { type: "json_schema", json_schema: ORDER_JSON_SCHEMA },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        result: null as AiOrderResult | null,
        error: "gateway" as const,
        status: res.status,
        detail: detail.slice(0, 300),
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(content) as Partial<AiOrderResult>;
      return { result: { ...EMPTY_AI_ORDER, ...parsed } as AiOrderResult };
    } catch {
      return { result: null as AiOrderResult | null, error: "bad_json" as const };
    }
  });
