"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import type { Locale } from "@/i18n/routing";

import { authClient } from "./auth-client";

/**
 * Email/password sign-in form. On success Better Auth answers either a
 * session (account still needs MFA enrollment → setup) or a two-factor
 * redirect (enrolled → challenge). Any failure surfaces as one generic
 * invalid-credentials message — no account-existence oracle.
 */
export function LoginForm({ locale }: { locale: Locale }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError) {
        setError(t("login.invalidCredentials"));
        return;
      }
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        router.replace(`/${locale}/admin/mfa`);
        return;
      }
      router.replace(`/${locale}/admin`);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <h1>{t("login.title")}</h1>
      <form onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="login-email">{t("login.email")}</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="login-password">{t("login.password")}</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending}>
          {pending ? t("login.submitting") : t("login.submit")}
        </button>
      </form>
    </main>
  );
}
