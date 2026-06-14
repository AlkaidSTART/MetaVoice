"use client";

import { useCallback, useEffect, useRef } from "react";
import { useVoiceContext, type VoiceCommand } from "./VoiceContext";
import { executeAction, matchVoiceToAction } from "./voiceActionMapper";

export interface UseVoiceCommandOptions {
  // 当收到绘制指令时调用
  onDraw?: (command: VoiceCommand) => void;
  // 当收到控制指令时调用
  onControl?: (command: VoiceCommand) => void;
  // 当收到 AI 生成指令时调用
  onAIGenerate?: (command: VoiceCommand) => void;
  // 当收到未知指令时调用
  onUnknown?: (command: VoiceCommand) => void;
  // 是否自动执行 UI 操作（如点击按钮）
  autoExecuteUI?: boolean;
}

/**
 * 全局语音指令处理 Hook
 *
 * 使用示例：
 * ```tsx
 * useVoiceCommand({
 *   onDraw: (cmd) => {
 *     // 处理绘制指令
 *   },
 *   onControl: (cmd) => {
 *     // 处理控制指令
 *   },
 *   autoExecuteUI: true, // 自动执行 UI 操作
 * });
 * ```
 */
export function useVoiceCommand(options: UseVoiceCommandOptions = {}) {
  const {
    onDraw,
    onControl,
    onAIGenerate,
    onUnknown,
    autoExecuteUI = true,
  } = options;

  const { registerCommandHandler, state, transcript, error } = useVoiceContext();
  const lastCommandRef = useRef<VoiceCommand | null>(null);

  // 处理指令
  const handleCommand = useCallback((command: VoiceCommand) => {
    // 避免重复处理相同指令
    if (lastCommandRef.current?.raw === command.raw) {
      return;
    }
    lastCommandRef.current = command;

    // 自动执行 UI 操作
    if (autoExecuteUI) {
      const matched = matchVoiceToAction(command.raw);
      if (matched) {
        executeAction(matched.action);
        return;
      }
    }

    // 指令分发由 canvas/page.tsx 的 processTranscript 处理
    // 此 hook 仅用于全局 UI 操作
    onDraw?.(command);
  }, [autoExecuteUI, onDraw, onControl, onAIGenerate, onUnknown]);

  // 注册指令处理器
  useEffect(() => {
    return registerCommandHandler(handleCommand);
  }, [registerCommandHandler, handleCommand]);

  return {
    state,
    transcript,
    error,
  };
}

/**
 * 全局语音控制 Hook（简化版）
 *
 * 只需要传入一个回调函数处理所有指令
 */
export function useVoiceControl(
  handler: (command: VoiceCommand) => void,
  deps: React.DependencyList = []
) {
  const { registerCommandHandler, state, transcript, error,
          startListening, stopListening } = useVoiceContext();

  const stableHandler = useRef(handler);
  useEffect(() => {
    stableHandler.current = handler;
  }, [handler, ...deps]);

  useEffect(() => {
    return registerCommandHandler((cmd) => stableHandler.current(cmd));
  }, [registerCommandHandler]);

  const isListening = state === "listening";

  return {
    state,
    transcript,
    isListening,
    error,
    startListening,
    stopListening,
  };
}
