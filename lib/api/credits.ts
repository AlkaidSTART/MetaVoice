import { ensureProfile, consumeCredits, getProfile } from "@/lib/supabase/db";

const creditFallbackStore = new Map<string, number>();

function isDatabaseUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Can't reach database server") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("P1001")
  );
}

function getFallbackCredits(userId: string) {
  if (!creditFallbackStore.has(userId)) {
    creditFallbackStore.set(userId, 50);
  }

  return creditFallbackStore.get(userId)!;
}

export async function ensureUserCredits(userId: string, email?: string) {
  try {
    const profile = await ensureProfile(userId, email);

    return {
      credits: profile.credits,
      fallback: false,
    };
  } catch (error) {
    if (!isDatabaseUnavailable(error)) {
      throw error;
    }

    return {
      credits: getFallbackCredits(userId),
      fallback: true,
    };
  }
}

export async function getUserCredits(userId: string, email?: string) {
  const ensured = await ensureUserCredits(userId, email);

  if (ensured.fallback) {
    return {
      credits: ensured.credits,
      fallback: true,
    };
  }

  const profile = await getProfile(userId);

  return {
    credits: profile?.credits ?? ensured.credits,
    fallback: false,
  };
}

export async function chargeCredits(userId: string, amount: number) {
  try {
    const result = await consumeCredits(userId, amount);

    return {
      ...result,
      fallback: false,
    };
  } catch (error) {
    if (!isDatabaseUnavailable(error)) {
      throw error;
    }

    const nextCredits = getFallbackCredits(userId);
    if (nextCredits < amount) {
      throw new Error("INSUFFICIENT_CREDITS");
    }

    const updated = nextCredits - amount;
    creditFallbackStore.set(userId, updated);

    return {
      credits: updated,
      fallback: true,
    };
  }
}
