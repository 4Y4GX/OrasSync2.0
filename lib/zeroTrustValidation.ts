// lib/zeroTrustValidation.ts

// Aggressive Emoji Regex (same style as your existing pages)
export const emojiRegex =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu;

export function removeEmojis(text: string) {
  return (text ?? "").replace(emojiRegex, "");
}

export function normalizeIdentifier(raw: string) {
  // zero trust: trim, strip emojis, remove spaces
  return removeEmojis(raw).trim().replace(/\s+/g, "");
}

// EMAIL ONLY (but UI can still say "USERNAME")
export function isPlausibleEmail(raw: string) {
  const v = normalizeIdentifier(raw);

  // zero trust minimal email shape:
  // - exactly one "@"
  // - at least one dot after "@"
  // - no spaces (already removed)
  // - reasonable allowed chars
  if (!v) return false;
  if (v.length > 254) return false;

  // basic allowed chars (no quotes, no unicode tricks)
  if (!/^[A-Za-z0-9._%+\-@]+$/.test(v)) return false;

  const at = v.indexOf("@");
  if (at <= 0) return false;
  if (v.indexOf("@", at + 1) !== -1) return false;

  const domain = v.slice(at + 1);
  if (domain.length < 3) return false; // a.b minimal
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (!domain.includes(".")) return false;

  return true;
}

// Strong password rule you already use elsewhere (15–20 only, must include upper/lower/number/symbol ! @ ? _ -)
export const STRONG_PASS_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@?_\-])[A-Za-z\d!@?_\-]{15,20}$/;

export function passwordChecks(pwRaw: string) {
  const pw = removeEmojis(pwRaw);

  const lengthOk = pw.length >= 15 && pw.length <= 20;
  const upperOk = /[A-Z]/.test(pw);
  const lowerOk = /[a-z]/.test(pw);
  const numberOk = /\d/.test(pw);
  const symbolOk = /[!@?_\-]/.test(pw);
  const onlyAllowed = /^[A-Za-z\d!@?_\-]*$/.test(pw);

  return {
    pw,
    lengthOk,
    upperOk,
    lowerOk,
    numberOk,
    symbolOk,
    onlyAllowed,
    strongOk: lengthOk && upperOk && lowerOk && numberOk && symbolOk && onlyAllowed,
  };
}
