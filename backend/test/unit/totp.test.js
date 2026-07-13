import { describe, expect, it } from "vitest";
import { generateSecret, generateTotp, verifyTotp, buildOtpAuthUri } from "../../src/lib/totp.js";

describe("totp", () => {
  it("genera un secreto base32 valido", () => {
    const secret = generateSecret();

    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(0);
  });

  it("genera codigos de 6 digitos", () => {
    const secret = generateSecret();

    const code = generateTotp(secret);

    expect(code).toMatch(/^\d{6}$/);
  });

  it("verifica un codigo generado con el mismo secreto y tiempo", () => {
    const secret = generateSecret();
    const time = Date.now();
    const code = generateTotp(secret, time);

    const valido = verifyTotp(secret, code, time);

    expect(valido).toBe(true);
  });

  it("rechaza un codigo con un secreto distinto", () => {
    const secretA = generateSecret();
    const secretB = generateSecret();
    const time = Date.now();
    const code = generateTotp(secretA, time);

    const valido = verifyTotp(secretB, code, time);

    expect(valido).toBe(false);
  });

  it("acepta un codigo dentro de la ventana de tolerancia de un paso", () => {
    const secret = generateSecret();
    const time = Date.now();
    const code = generateTotp(secret, time);

    const valido = verifyTotp(secret, code, time + 30_000);

    expect(valido).toBe(true);
  });

  it("rechaza un codigo fuera de la ventana de tolerancia", () => {
    const secret = generateSecret();
    const time = Date.now();
    const code = generateTotp(secret, time);

    const valido = verifyTotp(secret, code, time + 5 * 60_000);

    expect(valido).toBe(false);
  });

  it("rechaza codigo vacio o nulo", () => {
    const secret = generateSecret();

    expect(verifyTotp(secret, "")).toBe(false);
    expect(verifyTotp(secret, null)).toBe(false);
    expect(verifyTotp(secret, undefined)).toBe(false);
  });

  it("construye una URI otpauth valida", () => {
    const uri = buildOtpAuthUri("SECRETOBASE32", "cliente@demo.local");

    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=SECRETOBASE32");
    expect(uri).toContain(encodeURIComponent("cliente@demo.local"));
  });
});
