"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import type { Locale } from "@/i18n/routing";

import { authClient } from "./auth-client";

interface EnrollmentSecret {
  totpURI: string;
  backupCodes: string[];
}

/**
 * Mandatory first-login TOTP enrollment:
 *  1. re-enter the account password → server returns the TOTP URI and
 *     single-use backup codes
 *  2. confirm a code from the authenticator app → enrollment activates
 *     (`twoFactorEnabled` only flips after this verification)
 * Backup codes are rendered exactly once, in this response.
 */
export function MfaSetupForm({ locale }: { locale: Locale }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<EnrollmentSecret | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRequestEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password,
      });
      if (enableError || !data || !("totpURI" in data)) {
        setError(t("setup.enableFailed"));
        return;
      }
      setSecret({ totpURI: data.totpURI, backupCodes: data.backupCodes });
      setPassword("");
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  async function onConfirmEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({
        code,
      });
      if (verifyError) {
        setError(t("mfa.invalidCode"));
        return;
      }
      router.replace(`/${locale}/admin`);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  if (!secret) {
    return (
      <main className="auth-page">
        <h1>{t("setup.title")}</h1>
        <p>{t("setup.intro")}</p>
        <form onSubmit={onRequestEnrollment} noValidate>
          <div>
            <label htmlFor="setup-password">{t("login.password")}</label>
            <input
              id="setup-password"
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
            {pending ? t("setup.submitting") : t("setup.submit")}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <h1>{t("setup.title")}</h1>
      <section>
        <h2>{t("setup.authenticatorTitle")}</h2>
        <p>{t("setup.authenticatorInstructions")}</p>
        <p>
          <code className="auth-secret">{secret.totpURI}</code>
        </p>
      </section>
      <section>
        <h2>{t("setup.backupCodesTitle")}</h2>
        <p>{t("setup.backupCodesWarning")}</p>
        <ul className="auth-backup-codes">
          {secret.backupCodes.map((backupCode) => (
            <li key={backupCode}>
              <code>{backupCode}</code>
            </li>
          ))}
        </ul>
      </section>
      <form onSubmit={onConfirmEnrollment} noValidate>
        <div>
          <label htmlFor="setup-code">{t("mfa.totpLabel")}</label>
          <input
            id="setup-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending}>
          {pending ? t("mfa.verifying") : t("mfa.verify")}
        </button>
      </form>
    </main>
  );
}
