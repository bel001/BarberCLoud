import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(length = 20) {
  const bytes = crypto.randomBytes(length);
  let bits = "";

  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }

  let secret = "";

  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }

  return secret;
}

function base32Decode(base32) {
  let bits = "";

  for (const char of base32.toUpperCase().replace(/=+$/, "")) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;

  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 1_000_000).padStart(6, "0");
}

export function generateTotp(secret, time = Date.now(), step = 30) {
  const counter = Math.floor(time / 1000 / step);
  return hotp(secret, counter);
}

export function verifyTotp(secret, token, time = Date.now(), step = 30, window = 1) {
  if (!token) return false;

  const counter = Math.floor(time / 1000 / step);

  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    if (hotp(secret, counter + errorWindow) === String(token)) {
      return true;
    }
  }

  return false;
}

export function buildOtpAuthUri(secret, email, issuer = "BarberCloud") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
