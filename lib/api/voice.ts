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
