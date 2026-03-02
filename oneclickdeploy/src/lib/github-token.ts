import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function getGitHubAccessToken(req: NextRequest): Promise<string | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || typeof token.accessToken !== "string") {
    return null;
  }

  return token.accessToken;
}
