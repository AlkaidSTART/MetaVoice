import { createClient } from "@/lib/supabase/server";

export type ApiUser = {
  id: string;
  email: string;
};

export async function requireApiUser(): Promise<ApiUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    id: user.id,
    email: user.email || "",
  };
}
