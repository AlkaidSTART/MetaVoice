import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { prisma } from "@/lib/prisma/client";

// 字符串相似度计算（Levenshtein距离）
function calculateSimilarity(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  // 初始化矩阵
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 删除
        matrix[i][j - 1] + 1,      // 插入
        matrix[i - 1][j - 1] + cost // 替换
      );
    }
  }

  // 计算相似度分数 (0-1)
  const maxLen = Math.max(len1, len2);
  return 1 - (matrix[len1][len2] / maxLen);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const prompt = request.nextUrl.searchParams.get("prompt") || "";
    const threshold = parseFloat(request.nextUrl.searchParams.get("threshold") || "0.9");

    if (!prompt) {
      return jsonError("prompt is required", 400);
    }

    // 获取用户相关的历史记录
    const histories = await prisma.promptHistory.findMany({
      where: {
        OR: [
          { userId: user.id },
          { userId: null }
        ]
      },
      orderBy: { createdAt: "desc" },
    });

    // 计算相似度并排序
    const sortedHistories = histories
      .map(h => ({
        ...h,
        similarityScore: calculateSimilarity(prompt.trim().toLowerCase(), h.prompt.toLowerCase())
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore);

    // 找到相似度高于阈值的记录
    const matched = sortedHistories.find(h => h.similarityScore >= threshold);

    if (matched) {
      // 更新使用次数，并标记为可复用模板
      await prisma.promptHistory.update({
        where: { id: matched.id },
        data: {
          usageCount: { increment: 1 },
          similarityScore: matched.similarityScore,
          isTemplate: true,
        },
      });

      return jsonOk({ history: matched, matched: true });
    }

    return jsonOk({ history: null, matched: false });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to find similar prompt", 500, String(error));
  }
}