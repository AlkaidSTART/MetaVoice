export type PromptHistoryRecord = {
  id: string;
  userId: string | null;
  prompt: string;
  canvasParams: string;
  similarityScore: number;
  usageCount: number;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error || "Request failed");
  }

  return body as T;
}

export async function fetchPromptHistories(limit: number = 20) {
  const response = await fetch(`/api/prompts?limit=${limit}`, {
    method: "GET",
    credentials: "include",
  });

  return parseJson<{ histories: PromptHistoryRecord[] }>(response);
}

export async function savePromptHistory(prompt: string, canvasParams: object) {
  const response = await fetch("/api/prompts", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, canvasParams }),
  });

  return parseJson<{ history: PromptHistoryRecord }>(response);
}

export async function findSimilarPrompt(
  prompt: string,
  threshold: number = 0.9,
) {
  try {
    const response = await fetch(
      `/api/prompts/similar?prompt=${encodeURIComponent(prompt)}&threshold=${threshold}`,
      {
        method: "GET",
        credentials: "include",
      },
    );

    return parseJson<{ history: PromptHistoryRecord | null; matched: boolean }>(
      response,
    );
  } catch (error) {
    console.warn(
      "[prompts] findSimilarPrompt failed, falling back to unmatched:",
      error,
    );
    return { history: null, matched: false };
  }
}

export async function updatePromptHistory(id: string, canvasParams: object) {
  const response = await fetch(`/api/prompts/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ canvasParams }),
  });

  return parseJson<{ history: PromptHistoryRecord }>(response);
}

export async function deletePromptHistory(id: string) {
  const response = await fetch(`/api/prompts/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJson<{ success: boolean }>(response);
}
