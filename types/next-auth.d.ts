import "next-auth";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session { user: DefaultSession["user"] & { role?: "owner" } }
}

declare module "next-auth/jwt" {
  interface JWT { role?: "owner" }
}
