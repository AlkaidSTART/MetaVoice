import type { IntentResult } from "@/lib/voice/speechRecognition";

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error || "Request failed");
  }

  return body as T;
}

export async function analyzeIntent(transcript: string) {
  const response = await fetch("/api/intent/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript }),
  });

  return parseJson<IntentResult & { warning?: string }>(response);
}

export async function transcribeVoiceAudio(audio: Blob, mimeType?: string) {
  const formData = new FormData();
  const extension = mimeType?.includes("wav")
    ? "wav"
    : mimeType?.includes("mp3")
      ? "mp3"
      : "webm";

  formData.set("audio", new File([audio], `voice-input.${extension}`, { type: mimeType || audio.type || "audio/webm" }));

  const response = await fetch("/api/voice/transcribe", {
    method: "POST",
    body: formData,
  });

  return parseJson<{ transcript: string; duration?: number; warning?: string }>(
    response,
  );
}

export async function generateImage(prompt: string) {
  const response = await fetch("/api/image/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  return parseJson<{
    imageUrl: string;
    storageUrl?: string;
    taskId?: string;
    warning?: string;
  }>(response);
}
