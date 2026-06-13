"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Video, Eye, EyeOff, Loader2, AlertCircle, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password. Please try again.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  function fillDemo(type: "agent" | "admin") {
    setEmail(type === "agent" ? "agent@clearline.dev" : "admin@clearline.dev");
    setPassword(type === "agent" ? "agent123" : "admin123");
    setError("");
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--surface-base)" }}
    >
      {/* ── Left panel — branding ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10 relative overflow-hidden"
        style={{ background: "oklch(18% 0.04 250)" }}
      >
        {/* Background geometric grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(90% 0.1 250) 1px, transparent 1px), linear-gradient(90deg, oklch(90% 0.1 250) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow */}
        <div
          className="absolute top-1/3 -left-20 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ background: "var(--primary-500)" }}
        />

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--primary-500)" }}
            >
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold" style={{ color: "var(--neutral-100)" }}>
              ClearLine
            </span>
          </div>

          <h2
            className="text-3xl font-bold leading-tight mb-4"
            style={{ color: "var(--neutral-50)" }}
          >
            Real-time video<br />support platform
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--neutral-400)" }}>
            Connect with customers instantly via server-routed video calls. No P2P, no third-party APIs — fully under your control.
          </p>
        </div>

        <div className="relative space-y-3">
          {[
            { icon: "🎯", text: "Server-routed SFU — no peer-to-peer" },
            { icon: "🔐", text: "JWT invite links with expiry" },
            { icon: "📼", text: "Session recording & transcripts" },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-3">
              <span className="text-base">{f.icon}</span>
              <span className="text-sm" style={{ color: "var(--neutral-400)" }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] animate-fade-in">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-10">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--primary-500)" }}
            >
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg" style={{ color: "var(--neutral-100)" }}>ClearLine</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--neutral-50)" }}>
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: "var(--neutral-400)" }}>
              Sign in to your agent dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--neutral-400)" }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@clearline.dev"
                required
                className="cl-input"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--neutral-400)" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="cl-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: "var(--neutral-500)" }}
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "oklch(55% 0.20 25 / 0.10)",
                  border: "1px solid oklch(55% 0.20 25 / 0.25)",
                  color: "oklch(72% 0.18 25)",
                }}
                role="alert"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="cl-btn-primary w-full mt-2"
              style={{ padding: "13px 20px" }}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div
            className="mt-6 rounded-xl p-4 space-y-3"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" style={{ color: "var(--primary-400)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--neutral-400)" }}>
                Quick access
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo("agent")}
                className="cl-btn-ghost text-left justify-start text-xs rounded-lg"
                style={{ padding: "8px 12px", background: "var(--surface-overlay)" }}
              >
                <span>
                  <span className="block font-medium" style={{ color: "var(--neutral-200)" }}>Agent</span>
                  <span style={{ color: "var(--neutral-500)" }}>agent123</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("admin")}
                className="cl-btn-ghost text-left justify-start text-xs rounded-lg"
                style={{ padding: "8px 12px", background: "var(--surface-overlay)" }}
              >
                <span>
                  <span className="block font-medium" style={{ color: "var(--neutral-200)" }}>Admin</span>
                  <span style={{ color: "var(--neutral-500)" }}>admin123</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
