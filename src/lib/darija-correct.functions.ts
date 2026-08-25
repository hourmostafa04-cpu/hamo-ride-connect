import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ text: z.string().min(1).max(2000) });

const SYSTEM_PROMPT = `أنت مصحح نصوص الدارجة المغربية بعد التفريغ الصوتي (Speech-to-Text).
مهمتك: تصحيح أخطاء التفريغ فقط، بدون تغيير المعنى.

قواعد صارمة:
- رجّع النص بالدارجة المغربية الطبيعية. ممنوع الترجمة للعربية الفصحى.
- صحح الكلمات المسموعة غلط، مثال: "نيز" -> "نهز"، "السمعة" -> "السلعة"، "شارجي" تبقى "شارجي".
- حافظ على أسماء المدن المغربية صحيحة: مكناس، الرباط، الدار البيضاء، مراكش، طنجة، أكادير، فاس، وجدة، الجديدة، بني ملال، الناظور، العيون، الرشيدية، ورزازات، تطوان، سطات، خريبكة، القنيطرة، الصويرة، تازة، سلا، المحمدية، آسفي، برشيد...
- حافظ على الأرقام والأوزان والأثمنة وأحجام الشاحنات كما هي بالضبط (بدون تحويل ولا تقريب).
- ما تزيدش كلمات جديدة وما تحذفش معلومات.
- جاوب فقط بالنص المصحح، بلا شرح وبلا علامات اقتباس.`;

/** Post-process a Deepgram/Whisper Darija transcript: fix mis-heard words, keep meaning. */
export const correctDarijaText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { text: data.text, corrected: false, error: "missing_key" as const };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: data.text },
          ],
        }),
      });
      if (!res.ok) return { text: data.text, corrected: false, error: "gateway" as const };
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const out = (json.choices?.[0]?.message?.content ?? "").trim().replace(/^«|»$/g, "");
      if (!out) return { text: data.text, corrected: false, error: "empty" as const };
      return { text: out, corrected: out !== data.text, error: null };
    } catch {
      return { text: data.text, corrected: false, error: "network" as const };
    }
  });
