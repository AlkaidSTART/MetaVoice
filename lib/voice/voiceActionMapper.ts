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
 * Global page-level actions registered once in the layout.
 * These work across ALL pages.
 */
const PAGE_ACTIONS: ActionEntry[] = [
  { keywords: ["画板", "画布", "画画", "绘图", "创作"], selector: "[data-action='nav-canvas']", label: "画板" },
  { keywords: ["广场", "社区", "作品集", "大家"], selector: "[data-action='nav-square']", label: "广场" },
  { keywords: ["画廊", "作品库", "我的作品", "图库"], selector: "[data-action='nav-gallery']", label: "作品库" },
  { keywords: ["登录", "注册", "登陆"], selector: "[data-action='nav-login']", label: "登录" },
  { keywords: ["退出", "登出", "注销", "离开"], selector: "[data-action='nav-logout']", label: "退出" },
  { keywords: ["返回", "后退", "上一页", "回去"], selector: "[data-action='nav-back']", label: "返回" },
];

/**
 * Per-page action registries.
 */
const PAGE_ACTIONS_MAP: Record<string, ActionEntry[]> = {
  canvas: [
    { keywords: ["录音", "录制", "开始", "说话", "听"], selector: "[data-action='mic']", label: "录音" },
    { keywords: ["撤销", "后退", "取消"], selector: "[data-action='undo']", label: "撤销" },
    { keywords: ["重做", "前进", "恢复"], selector: "[data-action='redo']", label: "重做" },
    { keywords: ["清空", "清除", "重新", "重置"], selector: "[data-action='clear']", label: "清空" },
    { keywords: ["保存", "存"], selector: "[data-action='save']", label: "保存" },
    { keywords: ["导出", "下载"], selector: "[data-action='export']", label: "导出" },
  ],
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
 * First checks global page actions, then page-specific actions.
 */
export function matchVoiceToAction(
  transcript: string,
  pageName?: string,
): { action: ActionEntry; matchedKeyword: string } | null {
  const lower = transcript.toLowerCase();

  // 1. Try global page actions
  for (const action of PAGE_ACTIONS) {
    for (const kw of action.keywords) {
      if (lower.includes(kw)) {
        return { action, matchedKeyword: kw };
      }
    }
  }

  // 2. Try page-specific actions
  if (pageName && PAGE_ACTIONS_MAP[pageName]) {
    for (const action of PAGE_ACTIONS_MAP[pageName]) {
      for (const kw of action.keywords) {
        if (lower.includes(kw)) {
          return { action, matchedKeyword: kw };
        }
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
