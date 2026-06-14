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

/**
 * 将任意音频 Blob（webm/opus/mp4 等）解码并重新编码为 16kHz 单声道 WAV
 * 使用浏览器 Web Audio API，无需外部依赖
 * DashScope Qwen-ASR 要求 wav/mp3/ogg/flac/m4a/amr 格式，不原生支持 webm
 */
async function convertToWavBlob(audioBlob: Blob): Promise<Blob> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new AudioContext();

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    // 重采样到 16kHz 单声道（ASR 标准输入）
    const targetRate = 16000;
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();

    // 编码为 WAV (16-bit PCM, 单声道, 16kHz)
    const samples = rendered.getChannelData(0);
    const wavBuffer = encodeWav(samples, targetRate);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    await audioCtx.close();
  }
}

/** 将 Float32 PCM 样本编码为 16-bit WAV ArrayBuffer */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);          // sub-chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);  // sample rate
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true);          // bits per sample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
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

export async function transcribeVoiceAudio(audio: Blob, mimeType?: string) {
  // 将浏览器录制的 webm/mp4 音频转换为 WAV（DashScope Qwen-ASR 兼容格式）
  const isNativeSupported = /^(audio\/(wav|mp3|ogg|flac|m4a|amr))/.test(
    mimeType || audio.type || "",
  );
  const wavBlob = isNativeSupported ? audio : await convertToWavBlob(audio);
  const fileName = isNativeSupported ? `voice-input.${(mimeType || audio.type).split("/")[1]}` : "voice-input.wav";
  const fileType = isNativeSupported ? (mimeType || audio.type) : "audio/wav";

  const formData = new FormData();
  formData.set("audio", new File([wavBlob], fileName, { type: fileType }));

  const response = await fetch("/api/voice/transcribe", {
    method: "POST",
    body: formData,
  });

  return parseJson<{ transcript: string; duration?: number; warning?: string; credits?: number }>(
    response,
  );
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
