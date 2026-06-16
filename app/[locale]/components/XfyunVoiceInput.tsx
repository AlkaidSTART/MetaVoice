"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, AlertCircle, X } from "lucide-react";
import { normalizeVoiceTranscript, shouldRetryTranscript } from "../lib/voice-normalize";

interface VoiceInputProps {
  onTranscriptChange: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  transcript: string;
}

/** 听写词结果 */
interface XfyunCw {
  w: string;
}

/** 听写句子结果 */
interface XfyunWs {
  bg: number;
  ed: number;
  cw?: XfyunCw[];
  onebest?: string;
}

interface XfyunDecodedResult {
  ws?: XfyunWs[];
  ls?: number;
}

interface XfyunResult {
  action?: string;
  code?: string | number;
  message?: string;
  desc?: string;
  
  header?: {
    code: number;
    sid: string;
    status: number;
    message?: string;
  };
  
  payload?: {
    result?: {
      compress?: string;
      encoding?: string;
      format?: string;
      seq?: number;
      status?: number;
      text?: string;
    };
  };
  
  data?: {
    result?: {
      ws?: XfyunWs[];
    };
    status?: number;
    code?: string | number;
    message?: string;
  };
  
  sid?: string;
}

export default function XfyunVoiceInput({ onTranscriptChange, onFinalResult, transcript }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [partialResult, setPartialResult] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isStopRef = useRef(false);
  const latestTextRef = useRef("");
  const hasFinalizedRef = useRef(false);
  const onFinalResultRef = useRef(onFinalResult);
  const retryCountRef = useRef(0);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  const handleStop = useCallback((options?: { preserveText?: boolean; skipFinalize?: boolean }) => {
    setIsListening(false);
    isStopRef.current = true;

    if (
      !options?.skipFinalize &&
      !hasFinalizedRef.current &&
      onFinalResultRef.current &&
      latestTextRef.current.trim()
    ) {
      const normalized = normalizeVoiceTranscript(latestTextRef.current).normalized;
      if (normalized) {
        latestTextRef.current = normalized;
        onTranscriptChange(normalized);
      }
      hasFinalizedRef.current = true;
      onFinalResultRef.current(latestTextRef.current.trim());
    }
    
    if (wsRef.current) {
      try {
        const endPacket = {
          header: {
            app_id: "",
            res_id: "hot_words",
            status: 2,
          },
          payload: {
            audio: {
              encoding: "raw",
              sample_rate: 16000,
              channels: 1,
              bit_depth: 16,
              seq: 591,
              status: 2,
              audio: "",
            },
          },
        };
        wsRef.current.send(JSON.stringify(endPacket));
        
        setTimeout(() => {
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        }, 1000);
      } catch (err) {
        console.error("发送结束帧失败:", err);
        if (wsRef.current) {
          try {
            wsRef.current.close();
          } catch (e) {
            console.error("关闭连接失败:", e);
          }
          wsRef.current = null;
        }
      }
    }
    
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.error("关闭音频上下文失败:", e);
      }
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (!options?.preserveText) {
      latestTextRef.current = "";
    }
  }, [onTranscriptChange]);

  const startRecognition = useCallback(async function runRecognitionSession() {
    setRuntimeError(null);
    setPartialResult("");
    onTranscriptChange("");
    isStopRef.current = false;
    hasFinalizedRef.current = false;
    latestTextRef.current = "";

    setIsListening(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const apiResponse = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getUrl' }),
      });
      
      const apiData = await apiResponse.json();
      
      if (!apiData.success || !apiData.wsUrl) {
        throw new Error(apiData.error || '获取语音识别连接失败');
      }
      
      const { wsUrl, appId } = apiData;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const mediaStreamSource = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      
      mediaStreamSource.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      let seq = 0;
      scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (ws.readyState === WebSocket.OPEN && !isStopRef.current) {
          const inputBuffer = event.inputBuffer.getChannelData(0);
          const outputBuffer = new Int16Array(inputBuffer.length);
          
          for (let i = 0; i < inputBuffer.length; i++) {
            outputBuffer[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768));
          }
          
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(outputBuffer.buffer)));
          
          const audioPacket = {
            header: {
              app_id: appId,
              res_id: "hot_words",
              status: 1,
            },
            payload: {
              audio: {
                encoding: "raw",
                sample_rate: 16000,
                channels: 1,
                bit_depth: 16,
                seq: seq++,
                status: 1,
                audio: base64Audio,
              },
            },
          };
          
          ws.send(JSON.stringify(audioPacket));
        }
      };

      ws.onopen = () => {
        const startPacket = {
          header: {
            app_id: appId,
            res_id: "hot_words",
            status: 0,
          },
          parameter: {
            iat: {
              domain: "slm",
              language: "zh_cn",
              accent: "mandarin",
              eos: 4500,
              dwa: "wpgs",
              result: {
                encoding: "utf8",
                compress: "raw",
                format: "json",
              },
            },
          },
          payload: {
            audio: {
              encoding: "raw",
              sample_rate: 16000,
              channels: 1,
              bit_depth: 16,
              seq: 1,
              status: 0,
              audio: "",
            },
          },
        };
        ws.send(JSON.stringify(startPacket));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const result: XfyunResult = JSON.parse(event.data);
          
          const errorCode = result.code || result.header?.code;
          const errorDesc = result.desc || result.header?.message;
          
          if (errorCode && errorCode !== 0) {
            console.error(`讯飞语音识别错误 ${errorCode}: ${errorDesc}`);
            setRuntimeError(`语音识别错误 (${errorCode}): ${errorDesc || "未知错误"}`);
            handleStop();
            return;
          }
          
          let currentFrameText = "";

          if (result.payload?.result?.text) {
            try {
              const base64Text = result.payload.result.text;
              const binaryString = atob(base64Text);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const decodedText = new TextDecoder('utf-8').decode(bytes);
              
              const decodedResult: XfyunDecodedResult = JSON.parse(decodedText);
              
              if (decodedResult.ws && decodedResult.ws.length > 0) {
                let frameText = "";
                decodedResult.ws.forEach((item: XfyunWs) => {
                  if (item.cw && item.cw.length > 0) {
                    item.cw.forEach((cw: XfyunCw) => {
                      if (cw.w) {
                        frameText += cw.w;
                      }
                    });
                  }
                });
                
                if (frameText === "。" && latestTextRef.current.trim()) {
                  currentFrameText = latestTextRef.current + frameText;
                  latestTextRef.current = currentFrameText;
                } else {
                  currentFrameText = frameText;
                  latestTextRef.current = frameText;
                }

                const previewText = normalizeVoiceTranscript(latestTextRef.current).normalized;
                setPartialResult(previewText);
                onTranscriptChange(previewText);
              }
            } catch (decodeError) {
              console.error("解码讯飞响应失败:", decodeError);
            }
          }
          
          if (result.action === "result" && result.data?.result?.ws) {
            const wsData = result.data.result.ws;
            if (wsData && wsData.length > 0) {
              const text = wsData.map((item: XfyunWs) => item.onebest || "").join("");
              const normalizedText = normalizeVoiceTranscript(text).normalized;
              currentFrameText = normalizedText;
              latestTextRef.current = normalizedText;
              setPartialResult(normalizedText);
              onTranscriptChange(normalizedText);
            }
          }
          
          const headerStatus = result.header?.status;
          const resultStatus = result.payload?.result?.status;
          if (headerStatus === 2 || resultStatus === 2) {
            const normalizedFinal = normalizeVoiceTranscript(
              currentFrameText.trim() || latestTextRef.current.trim()
            ).normalized;

            if (!normalizedFinal || shouldRetryTranscript(normalizedFinal)) {
              if (retryCountRef.current < 1) {
                retryCountRef.current += 1;
                setIsRetrying(true);
                handleStop({ preserveText: true, skipFinalize: true });
                window.setTimeout(() => {
                  void runRecognitionSession().finally(() => setIsRetrying(false));
                }, 300);
                return;
              }
            }

            if (!hasFinalizedRef.current && onFinalResultRef.current && normalizedFinal) {
              latestTextRef.current = normalizedFinal;
              onTranscriptChange(normalizedFinal);
              hasFinalizedRef.current = true;
              onFinalResultRef.current(normalizedFinal);
            }
            handleStop({ preserveText: true });
          }
        } catch (e) {
          console.error("解析讯飞响应失败:", e);
        }
      };

      ws.onerror = (error: Event) => {
        console.error("WebSocket 错误:", error);
        setRuntimeError("语音识别连接错误，请检查网络连接");
        handleStop();
      };

      ws.onclose = (event) => {
        setIsListening(false);
      };

    } catch (err) {
      console.error("启动语音识别失败:", err);
      const errorMsg = err instanceof Error ? err.message : "未知错误";
      if (errorMsg.includes("Permission denied")) {
        setRuntimeError("麦克风访问被拒绝，请在浏览器设置中允许麦克风权限");
      } else {
        setRuntimeError(`无法启动语音识别: ${errorMsg}`);
      }
      setIsListening(false);
    }
  }, [handleStop, onTranscriptChange]);

  const startListening = useCallback(() => {
    retryCountRef.current = 0;
    void startRecognition();
  }, [startRecognition]);

  const stopListening = useCallback(() => {
    handleStop();
  }, [handleStop]);

  const clearTranscript = useCallback(() => {
    onTranscriptChange("");
    setPartialResult("");
    latestTextRef.current = "";
    retryCountRef.current = 0;
  }, [onTranscriptChange]);

  return (
    <div className="w-full">
      {runtimeError && (
        <div className="mb-3 p-3 bg-error/10 border border-error/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <p className="text-sm text-error">{runtimeError}</p>
        </div>
      )}
      
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isListening
              ? "bg-sakura text-white"
              : "bg-macaron-blue hover:bg-macaron-blue/90 text-white"
          }`}
          aria-label={isListening ? "停止录音" : "开始录音"}
          aria-pressed={isListening}
        >
          {isListening ? (
            <MicOff className="w-7 h-7" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
          
          {/* 录音脉冲动画 */}
          {isListening && (
            <>
              <span className="absolute inset-0 rounded-full bg-sakura/30 animate-ping" />
              <span className="absolute inset-0 rounded-full bg-sakura/20 animate-ping" style={{ animationDelay: "0.5s" }} />
            </>
          )}
        </button>
        
        <button
          onClick={clearTranscript}
          disabled={!transcript && !partialResult}
          className="p-3 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all"
          aria-label="清空"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {isListening && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sakura">
          <div className="w-2 h-2 bg-sakura rounded-full animate-pulse" />
          <span className="text-sm">正在录音...</span>
        </div>
      )}

      {isRetrying && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-text-secondary">
          <div className="h-2 w-2 rounded-full bg-lavender animate-pulse" />
          <span>刚刚没听清，正在再试一次…</span>
        </div>
      )}
      
    
    </div>
  );
}
