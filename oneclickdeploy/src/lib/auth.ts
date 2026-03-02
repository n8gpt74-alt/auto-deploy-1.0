import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

function requireEnv(name: "NEXTAUTH_SECRET" | "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nextAuthSecret = requireEnv("NEXTAUTH_SECRET");
const githubClientId = requireEnv("GITHUB_CLIENT_ID");
const githubClientSecret = requireEnv("GITHUB_CLIENT_SECRET");

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  session: { strategy: "jwt" },
  providers: [
    GitHubProvider({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      authorization: { params: { scope: "read:user user:email repo" } },
    }),
  ],
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.provider === "github" && account.access_token) {
        token.accessToken = account.access_token;
      }
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : token.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
