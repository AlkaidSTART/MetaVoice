export interface NormalizeResult {
  raw: string;
  normalized: string;
  replacedTokens: string[];
}

const TOKEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/气求/g, "气球"],
  [/采红/g, "彩虹"],
  [/小免子|小兔只|小秃子/g, "小兔子"],
  [/花花草草草/g, "花花草草"],
  [/再 再/g, "再"],
];

const RETRY_BLACKLIST = new Set(["嗯", "啊", "哦", "诶", "唉", "那个", "这个", "然后"]);

function collapseWhitespace(input: string) {
  return input
    .replace(/[，。！？、；：]/g, (match) => match)
    .replace(/\s+/g, "")
    .trim();
}

function normalizePunctuation(input: string) {
  return input
    .replace(/[,.]/g, "，")
    .replace(/[!?]/g, "！")
    .replace(/，{2,}/g, "，")
    .replace(/！{2,}/g, "！")
    .replace(/。{2,}/g, "。")
    .replace(/^[，。！？、；：]+|[，。！？、；：]+$/g, "");
}

export function normalizeVoiceTranscript(input: string): NormalizeResult {
  const raw = input;
  let normalized = normalizePunctuation(collapseWhitespace(input));
  const replacedTokens: string[] = [];

  for (const [pattern, replacement] of TOKEN_REPLACEMENTS) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement);
      replacedTokens.push(replacement);
    }
  }

  normalized = normalized
    .replace(/帮我帮我/g, "帮我")
    .replace(/给我给我/g, "给我")
    .replace(/画一个一个/g, "画一个")
    .replace(/再加一个一个/g, "再加一个")
    .trim();

  return {
    raw,
    normalized,
    replacedTokens,
  };
}

export function shouldRetryTranscript(input: string): boolean {
  const normalized = normalizeVoiceTranscript(input).normalized;

  if (!normalized) return true;
  if (/^[，。！？、；：]+$/.test(normalized)) return true;
  if (RETRY_BLACKLIST.has(normalized)) return true;
  if (normalized.length === 1 && !/[画云树猫狗花鱼鸟山海房太阳月虹星]/.test(normalized)) {
    return true;
  }

  return false;
}
