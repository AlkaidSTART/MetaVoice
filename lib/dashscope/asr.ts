
import { getDashScopeApiKey, getDashScopeBaseUrl } from "@/lib/api/config";

type TranscribeResult = {
  transcript: string;
  duration?: number;
  raw?: unknown;
};

/**
 * 确保 base URL 指向 OpenAI 兼容模式根路径
 * 兼容 DASHSCOPE_BASE_URL 设置为:
 *   - https://dashscope.aliyuncs.com/compatible-mode/v1
 *   - https://dashscope.aliyuncs.com
 */
function resolveCompatibleBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/compatible-mode/v1")) {
    return trimmed;
  }
  return `${trimmed}/compatible-mode/v1`;
}

/**
 * 从 File 对象推断音频格式标识符
 * Qwen-ASR input_audio.format 支持: wav, mp3, ogg, flac, m4a, amr
 * 注意: 浏览器 MediaRecorder 录制 webm;codecs=opus，
 * 需将容器格式映射到实际编码格式 opus
 */
function getAudioFormat(file: File): string {
  const name = (file.name || "audio.webm").toLowerCase();
  const mime = file.type || "";

  // 浏览器录制的 webm 实际编码为 opus
  if (name.endsWith(".webm") || mime.includes("webm")) return "opus";
  if (name.endsWith(".wav")) return "wav";
  if (name.endsWith(".mp3")) return "mp3";
  if (name.endsWith(".ogg")) return "ogg";
  if (name.endsWith(".flac")) return "flac";
  if (name.endsWith(".m4a")) return "m4a";
  if (name.endsWith(".amr")) return "amr";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp3") || mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("flac")) return "flac";
  if (mime.includes("m4a") || mime.includes("mp4")) return "m4a";
  return "wav"; // 安全默认值
}

/**
 * 将 File/ArrayBuffer 读取为 base64 字符串
 * 兼容 Node.js 服务端环境（使用 Buffer）
 */
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

/**
 * 解析 SSE (Server-Sent Events) 流式响应，提取最终转录文本
 * Qwen-ASR 流式返回格式:
 *   data: {"choices":[{"delta":{"content":"你"}}]}
 *   data: {"choices":[{"delta":{"content":"好"}}]}
 *   ...
 *   data: {"choices":[{"finish_reason":"stop"}], "usage":{...}}
 *   data: [DONE]
 */
async function parseStreamingTranscript(
  body: ReadableStream<Uint8Array>,
): Promise<{ transcript: string; raw?: unknown }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let transcript = "";
  let lastData: unknown;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // 记录所有非空行用于调试
      console.log("[Qwen-ASR SSE]", trimmed);
      if (!trimmed.startsWith("data: ")) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === "[DONE]") continue;
      try {
        const data = JSON.parse(dataStr);
        lastData = data;
        // 尝试多种可能的 content 路径
        const content =
          data?.choices?.[0]?.delta?.content ??
          data?.choices?.[0]?.message?.content ??
          data?.output?.text ??
          "";
        if (content) {
          transcript += content;
        }
      } catch (parseErr) {
        console.warn("[Qwen-ASR SSE parse error]", parseErr, "raw:", dataStr);
      }
    }
  }

  console.log("[Qwen-ASR] final transcript:", JSON.stringify(transcript));
  return { transcript, raw: lastData };
}

/**
 * 使用 Qwen3-ASR-Flash 模型进行语音识别
 * 通过 OpenAI 兼容的 /chat/completions 端点 + input_audio + 流式调用
 * 参考: https://help.aliyun.com/zh/model-studio/qwen-asr-api-reference
 *
 * 关键约束:
 *   - Qwen-ASR OpenAI 兼容模式必须使用 stream: true
 *   - webm 容器需映射为实际编码格式 opus
 */
export async function transcribeWithQwenASR(
  file: File,
): Promise<TranscribeResult> {
  const apiKey = getDashScopeApiKey();
  const rawBaseUrl = getDashScopeBaseUrl();

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const baseUrl = resolveCompatibleBaseUrl(rawBaseUrl);
  const audioBase64 = await fileToBase64(file);
  const audioFormat = getAudioFormat(file);

  const requestBody = {
    model: "qwen3-asr-flash",
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      {
        role: "user",
        content: [
          {
            input_audio: {
              data: audioBase64,
              format: audioFormat,
            },
          },
        ],
      },
    ],
  };

  console.log("[Qwen-ASR] Request:", {
    url: `${baseUrl}/chat/completions`,
    model: requestBody.model,
    audioFormat,
    audioBase64Length: audioBase64.length,
    fileSize: file.size,
    fileType: file.type,
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log("[Qwen-ASR] Response status:", response.status, response.statusText);

  if (!response.ok) {
    const text = await response.text();
    let details: unknown = text;
    try {
      details = JSON.parse(text);
    } catch {
      // keep raw text
    }
    throw new Error(
      `Qwen ASR request failed: ${response.status} ${JSON.stringify(details)}`,
    );
  }

  // 流式响应: 解析 SSE chunks 拼接完整转录
  if (response.body) {
    const result = await parseStreamingTranscript(response.body);
    if (result.transcript) {
      return {
        transcript: result.transcript,
        raw: result.raw,
      };
    }
  }

  // Fallback: 非流式 JSON 响应
  try {
    const data = await response.json();
    const transcript =
      data?.choices?.[0]?.message?.content || data?.output?.text || "";
    if (transcript) {
      return { transcript, raw: data };
    }
  } catch {
    // body already consumed by streaming reader
  }

  throw new Error("Qwen ASR 未返回识别结果，请重试");
}
