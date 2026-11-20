"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, User, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Password validation checks
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form validations
    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }

    if (name.trim().length < 2) {
      setErrorMessage("Name must be at least 2 characters long.");
      return;
    }

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage("Please provide a valid email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.error) {
        if (response.error.status === 500) {
          setErrorMessage(
            "Authentication server error (500). Please check your server environment variables (BETTER_AUTH_SECRET)."
          );
        } else {
          setErrorMessage(
            response.error.message || "Failed to create account. Please check details."
          );
        }
        setIsLoading(false);
        return;
      }

      // Successful registration: redirect to protected dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(
        errObj?.message || "An unexpected error occurred during registration."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50/50 relative overflow-hidden text-slate-900">
      {/* Background ambient sunset glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-sky-100/40 via-blue-100/30 to-sky-100/40 rounded-full blur-[150px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 p-0.5 shadow-md group-hover:scale-105 transition-transform flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-sky-600" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-2xl tracking-tight text-slate-900">
                SyncSpace
              </span>
              <Badge variant="brand" size="sm" className="font-mono text-[10px]">
                Register
              </Badge>
            </div>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Create an account
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Start collaborating with real-time multiplayer intelligence
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200/90 bg-white">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-[11px] font-mono uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sarah Chen"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-colors font-sans"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-mono uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@syncspace.app"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-colors font-sans"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-mono uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-colors font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-[11px] font-mono uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-colors font-sans"
                />
              </div>
            </div>

            {/* Password strength indicators */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasMinLength ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-slate-200 text-slate-400"}`}>
                  {hasMinLength ? "✓" : "•"}
                </span>
                <span className={hasMinLength ? "text-slate-800 font-semibold" : "text-slate-500"}>At least 8 characters</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasNumber ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-slate-200 text-slate-400"}`}>
                  {hasNumber ? "✓" : "•"}
                </span>
                <span className={hasNumber ? "text-slate-800 font-semibold" : "text-slate-500"}>Contains numbers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasLetter ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-slate-200 text-slate-400"}`}>
                  {hasLetter ? "✓" : "•"}
                </span>
                <span className={hasLetter ? "text-slate-800 font-semibold" : "text-slate-500"}>Contains letters</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${passwordsMatch ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-slate-200 text-slate-400"}`}>
                  {passwordsMatch ? "✓" : "•"}
                </span>
                <span className={passwordsMatch ? "text-slate-800 font-semibold" : "text-slate-500"}>Passwords match</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full font-medium"
              >
                <span>Create SyncSpace account</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-sky-600 hover:text-sky-700 underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs font-mono text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Back to SyncSpace Home
          </Link>
        </div>
      </div>
    </div>
  );
}
