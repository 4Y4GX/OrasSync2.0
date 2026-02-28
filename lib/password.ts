import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/** Hash a plain-text password */
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compare a plain-text password against a bcrypt hash */
export async function verifyPassword(
    plain: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

/** Check whether a stored value is already a bcrypt hash */
export function isBcryptHash(value: string): boolean {
    return /^\$2[aby]?\$\d{2}\$/.test(value);
}
