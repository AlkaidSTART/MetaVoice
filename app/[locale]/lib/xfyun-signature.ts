import crypto from 'crypto';

export interface XfyunConfig {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * 生成 RFC1123 格式的时间戳（UTC+0/GMT时区）
 * @returns 格式示例: Tue, 14 May 2024 08:46:48 GMT
 */
export function generateRFC1123Timestamp(): string {
  return new Date().toUTCString();
}

/**
 * 生成签名原始字段
 * @param host 请求主机
 * @param date RFC1123格式时间戳
 * @param requestLine 请求行 (如 "GET /v1 HTTP/1.1")
 * @returns signature_origin
 */
export function buildSignatureOrigin(host: string, date: string, requestLine: string): string {
  return `host: ${host}\ndate: ${date}\n${requestLine}`;
}

/**
 * 生成签名
 * @param signatureOrigin 签名原始字段
 * @param apiSecret API密钥
 * @returns base64编码的signature
 */
export function generateSignature(signatureOrigin: string, apiSecret: string): string {
  // 使用 HMAC-SHA256 计算签名
  const hmac = crypto.createHmac('sha256', apiSecret);
  hmac.update(signatureOrigin);
  const signatureSha = hmac.digest('base64');
  return signatureSha;
}

/**
 * 生成 authorization 参数
 * @param apiKey API Key
 * @param signature 签名
 * @returns base64编码的authorization
 */
export function generateAuthorization(apiKey: string, signature: string): string {
  // 构建 authorization 原始字符串
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  // 使用 base64 编码
  return Buffer.from(authorizationOrigin).toString('base64');
}

/**
 * 构建 WebSocket 语音听写 URL（讯飞 iat 服务）
 * @param config 讯飞配置
 * @returns WebSocket URL
 * @see https://www.xfyun.cn/doc/asr/voicedictation/API.html
 */
export function buildWsUrl(config: XfyunConfig): string {
  const host = 'iat.xf-yun.com';
  const requestLine = 'GET /v1 HTTP/1.1';
  const date = generateRFC1123Timestamp();
  
  // 构建签名原始字段
  const signatureOrigin = buildSignatureOrigin(host, date, requestLine);
  
  // 生成签名
  const signature = generateSignature(signatureOrigin, config.apiSecret);
  
  // 生成 authorization
  const authorization = generateAuthorization(config.apiKey, signature);
  
  return `wss://${host}/v1?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`;
}

/**
 * 构建 HTTP API 语音识别 URL
 * @param config 讯飞配置
 * @returns HTTP URL
 */
export function buildHttpUrl(config: XfyunConfig): string {
  const host = 'iat.xf-yun.com';
  const requestLine = 'GET /v1 HTTP/1.1';
  const date = generateRFC1123Timestamp();
  
  // 构建签名原始字段
  const signatureOrigin = buildSignatureOrigin(host, date, requestLine);
  
  // 生成签名
  const signature = generateSignature(signatureOrigin, config.apiSecret);
  
  // 生成 authorization
  const authorization = generateAuthorization(config.apiKey, signature);
  
  return `https://${host}/v1?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`;
}