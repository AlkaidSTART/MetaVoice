import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireApiUser } from "@/lib/api/auth";
import { chargeCredits, getUserCredits } from "@/lib/api/credits";
import { getDashScopeApiKey } from "@/lib/api/config";
import { transcribeWithQwenASR } from "@/lib/dashscope/asr";
import { parseTranscript } from "@/lib/voice/speechRecognition";

// =============== 讯飞 WebSocket 相关 ===============

/**
 * 生成 RFC1123 格式的时间戳（UTC+0/GMT时区）
 */
function generateRFC1123Timestamp(): string {
  return new Date().toUTCString();
}

/**
 * 生成签名原始字段
 */
function buildSignatureOrigin(host: string, date: string, requestLine: string): string {
  return `host: ${host}\ndate: ${date}\n${requestLine}`;
}

/**
 * 生成签名
 */
function generateSignature(signatureOrigin: string, apiSecret: string): string {
  const hmac = crypto.createHmac('sha256', apiSecret);
  hmac.update(signatureOrigin);
  return hmac.digest('base64');
}

/**
 * 生成 authorization 参数
 */
function generateAuthorization(apiKey: string, signature: string): string {
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  return Buffer.from(authorizationOrigin).toString('base64');
}

/**
 * 构建 WebSocket 语音听写 URL（讯飞 iat 服务）
 */
function buildWsUrl(appId: string, apiKey: string, apiSecret: string): string {
  const host = 'iat.xf-yun.com';
  const requestLine = 'GET /v1 HTTP/1.1';
  const date = generateRFC1123Timestamp();
  
  const signatureOrigin = buildSignatureOrigin(host, date, requestLine);
  const signature = generateSignature(signatureOrigin, apiSecret);
  const authorization = generateAuthorization(apiKey, signature);
  
  return `wss://${host}/v1?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`;
}

// =============== DashScope ASR 相关 ===============

export async function POST(req: NextRequest) {
  try {
    // 支持讯飞 WebSocket URL 获取
    if (req.nextUrl.searchParams.get("xfyun") === "true") {
      const APP_ID = process.env.NEXT_PUBLIC_XFYUN_APP_ID;
      const API_KEY = process.env.NEXT_PUBLIC_XFYUN_API_KEY;
      const API_SECRET = process.env.NEXT_PUBLIC_XFYUN_API_SECRET;

      if (!APP_ID || !API_KEY || !API_SECRET) {
        console.error('讯飞API配置缺失');
        return NextResponse.json(
          { error: '语音识别服务未配置' },
          { status: 503 }
        );
      }

      const wsUrl = buildWsUrl(APP_ID, API_KEY, API_SECRET);
      return NextResponse.json({
        success: true,
        wsUrl,
        appId: APP_ID,
      });
    }

    // DashScope 语音识别
    const user = await requireApiUser();
    const currentCredits = await getUserCredits(user.id, user.email);
    if (currentCredits.credits < 1) {
      return NextResponse.json(
        { error: "积分不足", credits: currentCredits.credits },
        { status: 402 },
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // 如果没有配置 DashScope API Key，使用本地解析器
    if (!getDashScopeApiKey()) {
      const localParsed = parseTranscript("画一个红色圆形");
      const charged = await chargeCredits(user.id, 1);
      return NextResponse.json({
        transcript: "画一个红色圆形",
        warning: "DASHSCOPE_API_KEY not configured, using local mock",
        credits: charged.credits,
      });
    }

    // 使用 qwen3-asr-flash 模型进行语音识别
    const data = await transcribeWithQwenASR(audioFile);
    const charged = await chargeCredits(user.id, 1);
    return NextResponse.json({
      transcript: data.transcript,
      duration: data.duration,
      credits: charged.credits,
      warning: charged.fallback
        ? "Database unavailable, using local development credits."
        : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: "积分不足" }, { status: 402 });
    }
    console.error("[api/voice/transcribe] request failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}