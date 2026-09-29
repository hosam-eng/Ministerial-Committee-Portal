"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import type { Locale } from "@/i18n/routing";

import { authClient } from "./auth-client";

/**
 * Second-factor challenge after password sign-in: TOTP by default,
 * single-use backup code as the alternate path. `trustDevice` is never
 * sent — no trusted-device bypass exists.
 */
export function MfaChallengeForm({ locale }: { locale: Locale }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result =
        mode === "totp"
          ? await authClient.twoFactor.verifyTotp({ code })
          : await authClient.twoFactor.verifyBackupCode({ code });
      if (result.error) {
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

  return (
    <div className="auth-card ui-surface">
      <h1>{t("mfa.title")}</h1>
      <p>{t("mfa.instructions")}</p>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="ui-field">
          <label htmlFor="mfa-code">
            {mode === "totp" ? t("mfa.totpLabel") : t("mfa.backupLabel")}
          </label>
          <input
            id="mfa-code"
            className="ui-input"
            name="code"
            type="text"
            inputMode={mode === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="ui-alert ui-alert-error">
            {error}
          </p>
        ) : null}
        <div className="ui-action-group ui-action-group--stack">
          <button
            type="submit"
            className="ui-button ui-button-primary"
            disabled={pending}
          >
            {pending ? t("mfa.verifying") : t("mfa.verify")}
          </button>
          <button
            type="button"
            className="ui-button ui-button-secondary"
            onClick={() => {
              setMode(mode === "totp" ? "backup" : "totp");
              setCode("");
              setError(null);
            }}
          >
            {mode === "totp" ? t("mfa.useBackupCode") : t("mfa.useTotp")}
          </button>
        </div>
      </form>
    </div>
  );
}
