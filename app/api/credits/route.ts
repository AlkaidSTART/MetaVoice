import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getUserCredits } from "@/lib/api/credits";

export async function GET() {
  try {
    const user = await requireApiUser();
    const credits = await getUserCredits(user.id, user.email);
    return jsonOk({
      credits: credits.credits,
      warning: credits.fallback
        ? "Database unavailable, using local development credits."
        : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to fetch credits", 500, String(error));
  }
}
