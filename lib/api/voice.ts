import type { IntentResult } from "@/lib/voice/speechRecognition";

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  
  if (!response.ok) {
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // 如果不是 JSON，保持为文本
    }
    throw new Error((body as { error?: string })?.error || text || "Request failed");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON response");
  }
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

export async function processWithAgent(transcript: string) {
  const response = await fetch("/api/agent/process", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript }),
  });

  return parseJson<{
    intent: IntentResult;
    raw?: unknown;
    warning?: string;
  }>(response);
}

export async function generateImage(prompt: string, sourceImageDataUrl: string) {
  const response = await fetch("/api/image/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, sourceImageDataUrl }),
  });

  return parseJson<{
    imageUrl: string;
    storageUrl?: string;
    taskId?: string;
    warning?: string;
    credits?: number;
  }>(response);
}

export async function fetchCredits() {
  const response = await fetch("/api/credits", {
    method: "GET",
    credentials: "include",
  });

  return parseJson<{ credits: number; warning?: string }>(response);
}
