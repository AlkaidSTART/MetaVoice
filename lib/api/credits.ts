import { ensureProfile, consumeCredits, getProfile } from "@/lib/supabase/db";

export async function ensureUserCredits(userId: string, email?: string) {
  const profile = await ensureProfile(userId, email);

  return {
    credits: profile.credits,
  };
}

export async function getUserCredits(userId: string, email?: string) {
  const ensured = await ensureUserCredits(userId, email);
  const profile = await getProfile(userId);

  return {
    credits: profile?.credits ?? ensured.credits,
  };
}

export async function chargeCredits(userId: string, amount: number) {
  return consumeCredits(userId, amount);
}
