import { dashScopeFetch } from "@/lib/dashscope/client";

type TranscribeResult = {
  transcript: string;
  duration?: number;
  raw?: unknown;
};

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

export async function transcribeAudioFile(file: File): Promise<TranscribeResult> {
  const arrayBuffer = await file.arrayBuffer();
  const base64Audio = toBase64(arrayBuffer);
  const audioFormat = file.type.includes("wav")
    ? "wav"
    : file.type.includes("mp3")
      ? "mp3"
      : "webm";

  const response = await dashScopeFetch(
    "/api/v1/services/audio/asr/transcription",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen3-asr-flash",
        input: {
          file: `data:audio/${audioFormat};base64,${base64Audio}`,
        },
        parameters: {
          language_hints: ["zh", "en"],
        },
      }),
    },
  );

  const data = await response.json();
  const firstResult = data?.output?.results?.[0];

  return {
    transcript: firstResult?.transcription || "",
    duration: firstResult?.duration,
    raw: data,
  };
}
