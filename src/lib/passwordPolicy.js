// Rejects passwords an attacker would try first. The wizard already
// demands 6+ characters and a special character; this catches the ones
// that pass that rule but are still a dictionary word with a digit and
// a "!" glued on, or the wallet's own name.

// Common passwords and words, compared after lowercasing and dropping
// everything but letters ("Password123!" → "password").
const COMMON = new Set([
  "password", "passwd", "passwort", "pass", "sifre", "parola", "secret", "letmein", "welcome", "admin", "login",
  "qwerty", "qwertyuiop", "asdfghjkl", "zxcvbnm", "qazwsx", "zaqwsx", "qweasd", "asdfgh", "qwerasdf",
  "abc", "abcd", "abcdef", "abcdefg", "test", "testing", "temp", "demo", "guest", "user", "root", "default", "changeme",
  "iloveyou", "loveyou", "love", "hello", "monkey", "dragon", "master", "shadow", "sunshine", "princess", "football",
  "baseball", "basketball", "soccer", "hockey", "superman", "batman", "starwars", "pokemon", "naruto", "trustno",
  "freedom", "whatever", "cheese", "cookie", "chocolate", "banana", "orange", "purple", "yellow", "silver", "golden",
  "summer", "winter", "spring", "autumn", "flower", "pepper", "ginger", "computer", "internet", "killer", "hunter",
  "buster", "matrix", "charlie", "michael", "jennifer", "jessica", "joshua", "daniel", "andrew", "thomas", "robert",
  "george", "ashley", "bailey", "nicole", "hannah", "taylor", "jordan", "harley", "mustang", "access", "london",
  "istanbul", "ankara", "turkiye", "galatasaray", "fenerbahce", "besiktas",
  "navio", "nav", "wallet", "crypto", "bitcoin", "blockchain", "coin", "money", "cash", "bank", "seed", "mnemonic",
]);

const lettersOnly = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/**
 * @returns {'common'|'name'|null} why the password is unacceptable, or null when it is fine.
 */
export function passwordProblem(password, walletName = "") {
  const core = lettersOnly(password);
  if (core.length > 0 && COMMON.has(core)) return "common";
  // "123456!" and friends: digits/symbols only, nothing to remember but a pattern.
  if (core.length === 0 && /^(\d)\1*[^a-z0-9]*$|^(0123456789|123456789?0?|1234567?8?9?|987654321?0?)[^a-z0-9]*$/i.test(String(password ?? ""))) return "common";
  const name = lettersOnly(walletName);
  if (name.length >= 3 && core.length > 0 && core === name) return "name";
  return null;
}
