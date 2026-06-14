import {
  getFunAsrApiKey,
  getFunAsrApiUrl,
  getFunAsrLanguageHints,
  getFunAsrModel,
} from "@/lib/api/config";

type TranscribeResult = {
  transcript: string;
  duration?: number;
  raw?: unknown;
};

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

export async function transcribeAudioFile(file: File): Promise<TranscribeResult> {
  const apiUrl = getFunAsrApiUrl();
  if (!apiUrl) {
    throw new Error("FUNASR_API_URL is not configured");
  }

  const arrayBuffer = await file.arrayBuffer();
  const mimeType = file.type || "audio/webm";
  const payload = {
    model: getFunAsrModel(),
    audio: toBase64(arrayBuffer),
    audio_format: mimeType.split("/")[1] || "webm",
    language_hints: getFunAsrLanguageHints(),
  };

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const apiKey = getFunAsrApiKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let details: unknown = text;
    try {
      details = JSON.parse(text);
    } catch {
      // 如果不是 JSON，保持为文本
    }

    throw new Error(
      `FunASR request failed: ${response.status} ${JSON.stringify(details)}`,
    );
  }

  const data = await response.json();
  const transcript =
    data?.transcript ||
    data?.text ||
    data?.result?.text ||
    data?.result?.transcript ||
    data?.output?.text ||
    "";
  const duration =
    data?.duration ||
    data?.result?.duration ||
    data?.audio_duration_ms ||
    undefined;

  return {
    transcript,
    duration: typeof duration === "number" ? duration : undefined,
    raw: data,
  };
}
