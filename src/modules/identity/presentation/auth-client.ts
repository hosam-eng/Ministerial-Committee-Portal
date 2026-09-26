"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Same-origin, cookie-based — no tokens
 * are ever placed in localStorage/sessionStorage. `trustDevice` is never
 * sent, so no trusted-device cookie is ever created.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
