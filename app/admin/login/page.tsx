import { signIn } from "@/auth";

export default function LoginPage() {
  return <main className="login-shell"><form className="login-card" action={async (formData) => { "use server"; await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: "/admin" }); }}>
    <span className="eyebrow">OWNER PORTAL</span><h1>Welcome back.</h1><p>Sign in to manage your car wash.</p>
    <label>Email address<input type="email" name="email" autoComplete="username" required /></label>
    <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
    <button className="button" type="submit">Sign in</button>
  </form></main>;
}
