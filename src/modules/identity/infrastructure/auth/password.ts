import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id password hashing — the only sanctioned password-hashing
 * implementation in the codebase. @node-rs/argon2 defaults to Argon2id;
 * parameters follow the OWASP second recommended configuration
 * (m=64 MiB, t=3, p=4). The encoded PHC string records them, so
 * verification is self-describing.
 *
 * Better Auth calls these through `emailAndPassword.password`; no other
 * code path may hash or compare credentials.
 */
const ARGON2ID_PARAMETERS = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID_PARAMETERS);
}

export async function verifyPassword({
  hash: hashValue,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  try {
    return await verify(hashValue, password);
  } catch {
    // Malformed stored hash — fail closed, never throw a credential oracle.
    return false;
  }
}
