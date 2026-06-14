import { getDashScopeApiKey, getDashScopeBaseUrl } from "@/lib/api/config";

type DashScopeRequestInit = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
};

/**
 * 从 base URL 中剥离 /compatible-mode/v1 后缀，
 * 确保 dashScopeFetch 始终使用 DashScope 原生 API 根路径。
 * 兼容两种 DASHSCOPE_BASE_URL 配置：
 *   - https://dashscope.aliyuncs.com/compatible-mode/v1（OpenAI 兼容模式）
 *   - https://dashscope.aliyuncs.com（原生模式）
 */
function resolveNativeBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/compatible-mode/v1")) {
    return trimmed.slice(0, -"/compatible-mode/v1".length);
  }
  return trimmed;
}

export async function dashScopeFetch(
  path: string,
  init: DashScopeRequestInit = {},
) {
  const apiKey = getDashScopeApiKey();

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const baseUrl = resolveNativeBaseUrl(getDashScopeBaseUrl());
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
