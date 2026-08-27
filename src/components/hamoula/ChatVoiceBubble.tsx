import { useEffect, useState } from "react";
import { VoiceNotePlayer } from "@/components/hamoula/Voice";
import { voiceUrl, type ChatVoice } from "@/lib/hamoula-chat";

/** Voice message inside a chat bubble: resolves the stored audio then plays it. */
export function ChatVoiceBubble({ voice }: { voice: ChatVoice }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void voiceUrl(voice.path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [voice.path]);

  return (
    <VoiceNotePlayer duration={voice.duration} transcript={voice.transcript ?? ""} audioUrl={url} />
  );
}
