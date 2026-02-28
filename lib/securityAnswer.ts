import bcrypt from "bcryptjs";
import { isBcryptHash } from "@/lib/password";

const SALT_ROUNDS = 10;

/** Normalize a security answer (trim + lowercase) before hashing or comparing. */
function normalize(plain: string): string {
    return plain.trim().toLowerCase();
}

/** Hash a security answer (normalised to lowercase). */
export async function hashSecurityAnswer(plain: string): Promise<string> {
    return bcrypt.hash(normalize(plain), SALT_ROUNDS);
}

/**
 * Verify a security answer against the stored value.
 *
 * Supports both bcrypt-hashed and legacy plaintext values.
 * Returns `{ match, needsMigration }`:
 *   - `match`          — whether the answer is correct
 *   - `needsMigration` — true when the stored value was plaintext (caller should upgrade)
 */
export async function verifySecurityAnswer(
    plain: string,
    storedHash: string
): Promise<{ match: boolean; needsMigration: boolean }> {
    const normalised = normalize(plain);

    if (isBcryptHash(storedHash)) {
        // Modern path: compare against bcrypt hash
        const match = await bcrypt.compare(normalised, storedHash);
        return { match, needsMigration: false };
    }

    // Legacy path: stored value is plaintext — compare directly (normalised)
    const match = normalize(storedHash) === normalised;
    return { match, needsMigration: match }; // only migrate on correct answer
}
