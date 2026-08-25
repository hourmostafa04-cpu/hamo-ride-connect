import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  audioBase64: z.string().min(16),
  mimeType: z.string().min(3).max(80),
  /** "phone" switches the prompt to digit-by-digit dictation. */
  mode: z.enum(["general", "phone", "city", "cargo"]).optional(),
});


/** Transcribe a recorded voice note (Arabic/Darija) with OpenAI gpt-4o-transcribe. */
export const transcribeVoiceNote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey && !process.env["OPENAI_API_KEY"]) {
      return { text: "", error: "missing_key" as const };
    }

    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength < 2048) return { text: "", error: "empty_audio" as const };
    if (bytes.byteLength > 20 * 1024 * 1024) return { text: "", error: "too_large" as const };

    const base = data.mimeType.split(";")[0] ?? "audio/webm";
    const ext =
      (
        {
          "audio/webm": "webm",
          "audio/mp4": "mp4",
          "audio/mpeg": "mp3",
          "audio/wav": "wav",
          "audio/ogg": "ogg",
        } as Record<string, string>
      )[base] ?? "webm";

    const ORDER_PROMPT =
      "هذا تسجيل بالدارجة المغربية لمستخدم تطبيق حمولة لنقل البضائع في المغرب. " +
      "توقع كلمات مغربية مثل: بغيت، نهز، السلعة، البضاعة، كاميو، شاحنة، طن، كيلو، درهم، " +
      "التحميل، التفريغ، الثمن، مكناس، الرباط، كازا، الدار البيضاء، فاس، مراكش، طنجة، أكادير، القنيطرة. " +
      "اكتب ما قاله المستخدم كما نطق به بالدارجة المغربية، ولا تحوله إلى العربية الفصحى. " +
      "حافظ بدقة على المدن والأرقام والأوزان والأسعار.";

    const PHONE_PROMPT =
      "هذا تسجيل لرقم هاتف مغربي منطوق رقما رقما بالدارجة المغربية. " +
      "الكلمات المتوقعة فقط: صفر، زيرو، واحد، جوج، تلاتة، ربعة، خمسة، ستة، سبعة، تمنية، تسعة. " +
      "اكتب الكلمات كما نطقت، لا تجمع الأرقام ولا تكتب مدنا ولا سلعا ولا كلمات أخرى.";

    const CITY_PROMPT =
      "هذا تسجيل قصير لاسم مدينة أو منطقة مغربية فقط. " +
      "الكلمات المتوقعة: مكناس، الرباط، كازا، الدار البيضاء، فاس، مراكش، طنجة، أكادير، القنيطرة، " +
      "وجدة، تطوان، الجديدة، آسفي، سلا، تمارة، بني ملال، خريبكة، الناظور، العيون، الرشيدية، ورزازات، الصويرة. " +
      "اكتب فقط اسم المكان بالعربية بلا أي كلمات أخرى ولا أرقام.";

    const CARGO_PROMPT =
      "هذا تسجيل قصير لنوع السلعة أو البضاعة بالدارجة المغربية فقط. " +
      "الكلمات المتوقعة: زليج، خضر، خضرة، فواكه، أثاث، رمل، رملة، إسمنت، حديد، خشب، " +
      "مواد البناء، أجهزة، ملابس، دقيق، زيت، ماء، طوب، جبس، آجور، بضاعة. " +
      "اكتب فقط اسم السلعة بكلمات قليلة بلا مدن ولا أثمان ولا أرقام.";

    const PROMPT =
      data.mode === "phone"
        ? PHONE_PROMPT
        : data.mode === "city"
          ? CITY_PROMPT
          : data.mode === "cargo"
            ? CARGO_PROMPT
            : ORDER_PROMPT;


    const form = new FormData();
    form.append("file", new Blob([bytes], { type: base }), `recording.${ext}`);
    form.append("language", "ar");
    form.append("prompt", PROMPT);

    // Direct OpenAI when the key is configured; otherwise the Lovable AI gateway
    // (same gpt-4o-transcribe model). The key stays server-side either way.
    const openAiKey = process.env["OPENAI_API_KEY"];
    const url = openAiKey
      ? "https://api.openai.com/v1/audio/transcriptions"
      : "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
    form.append("model", openAiKey ? "gpt-4o-transcribe" : "openai/gpt-4o-transcribe");

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey ?? apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        text: "",
        error: "gateway" as const,
        status: res.status,
        detail: detail.slice(0, 300),
      };
    }

    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });
