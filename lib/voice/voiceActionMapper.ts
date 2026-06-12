"use client";

/**
 * Voice Action Mapper — maps voice command keywords to UI element selectors,
 * then animates the custom cursor to that element and triggers a click.
 */

type ActionEntry = {
  keywords: string[];
  selector: string;
  label: string;
  /** If true, calls the action directly instead of clicking */
  directAction?: () => void;
};

/**
 * Canvas page actions registry.
 * These are matched against voice transcript text.
 */
const CANVAS_ACTIONS: ActionEntry[] = [
  // Recording
  {
    keywords: ["录音", "录制", "开始", "说话", "听"],
    selector: "[data-action='mic']",
    label: "录音",
  },
  // Edit
  {
    keywords: ["撤销", "后退", "取消"],
    selector: "[data-action='undo']",
    label: "撤销",
  },
  {
    keywords: ["重做", "前进", "恢复"],
    selector: "[data-action='redo']",
    label: "重做",
  },
  {
    keywords: ["清空", "清除", "重新", "重置"],
    selector: "[data-action='clear']",
    label: "清空",
  },
  // Save/Export
  {
    keywords: ["保存", "存"],
    selector: "[data-action='save']",
    label: "保存",
  },
  {
    keywords: ["导出", "下载"],
    selector: "[data-action='export']",
    label: "导出",
  },
  // Navigation
  {
    keywords: ["广场", "社区", "作品集"],
    selector: "[data-action='square']",
    label: "广场",
  },
  {
    keywords: ["画廊", "作品库", "我的作品"],
    selector: "[data-action='gallery']",
    label: "作品库",
  },
  {
    keywords: ["退出", "登出", "注销"],
    selector: "[data-action='logout']",
    label: "退出",
  },
];

/**
 * Match a voice transcript against known UI actions.
 * Returns the matching ActionEntry and its matched keyword, or null.
 */
export function matchVoiceToAction(
  transcript: string,
): { action: ActionEntry; matchedKeyword: string } | null {
  const lower = transcript.toLowerCase();

  for (const action of CANVAS_ACTIONS) {
    for (const kw of action.keywords) {
      if (lower.includes(kw)) {
        return { action, matchedKeyword: kw };
      }
    }
  }

  return null;
}

/**
 * Execute a UI action by animating the custom cursor to the element.
 * If the element has a directAction, call it instead of simulating a click.
 */
export function executeAction(action: ActionEntry): void {
  const animate = (window as any).__voiceCursorAnimate as
    | ((selector: string, onClick?: () => void) => void)
    | undefined;

  if (!animate) {
    // fallback: direct click if cursor not available
    const el = document.querySelector(action.selector) as HTMLElement | null;
    el?.click();
    return;
  }

  animate(action.selector, () => {
    const el = document.querySelector(action.selector) as HTMLElement | null;
    el?.click();
  });
}
