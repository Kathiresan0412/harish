import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(credentials);
      if (!parsed.success) return null;
      await connectToDatabase();
      const user = await User.findOne({ email: parsed.data.email.toLowerCase(), active: true }).select("+passwordHash");
      if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email, role: "owner" };
    },
  })],
  callbacks: {
    async jwt({ token, user }) { if (user) token.role = "owner"; return token; },
    async session({ session, token }) { if (session.user) session.user.role = token.role as "owner"; return session; },
  },
});
