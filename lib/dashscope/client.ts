import { getDashScopeApiKey, getDashScopeBaseUrl } from "@/lib/api/config";

type DashScopeRequestInit = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
};

export async function dashScopeFetch(
  path: string,
  init: DashScopeRequestInit = {},
) {
  const apiKey = getDashScopeApiKey();

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const baseUrl = getDashScopeBaseUrl().replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...init.headers,
    },
    body: init.body,
  });

  if (!response.ok) {
    let details: unknown = null;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    throw new Error(
      `DashScope request failed: ${response.status} ${JSON.stringify(details)}`,
    );
  }

  return response;
}
