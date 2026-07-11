import { describe, expect, it } from "vitest";
import { generateSecret, generateTotp, verifyTotp, buildOtpAuthUri } from "../../src/lib/totp.js";

describe("totp", () => {
  it("genera un secreto base32 valido", () => {
    // Act
    const secret = generateSecret();

    // Assert
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(0);
  });

  it("genera codigos de 6 digitos", () => {
    // Arrange
    const secret = generateSecret();

    // Act
    const code = generateTotp(secret);

    // Assert
    expect(code).toMatch(/^\d{6}$/);
  });

  it("verifica un codigo generado con el mismo secreto y tiempo", () => {
    // Arrange
    const secret = generateSecret();
    const time = Date.now();
    const code = generateTotp(secret, time);

    // Act
    const valido = verifyTotp(secret, code, time);

    // Assert
    expect(valido).toBe(true);
  });

  it("rechaza un codigo con un secreto distinto", () => {
    // Arrange
    const secretA = generateSecret();
    const secretB = generateSecret();
    const time = Date.now();
    const code = generateTotp(secretA, time);

    // Act
    const valido = verifyTotp(secretB, code, time);

    // Assert
    expect(valido).toBe(false);
  });

  it("acepta un codigo dentro de la ventana de tolerancia de un paso", () => {
    // Arrange
    const secret = generateSecret();
    const time = Date.now();
    const code = generateTotp(secret, time);

    // Act: 30 segundos despues (un paso), deberia seguir siendo valido
    const valido = verifyTotp(secret, code, time + 30_000);

    // Assert
    expect(valido).toBe(true);
  });

  it("rechaza un codigo fuera de la ventana de tolerancia", () => {
    // Arrange
    const secret = generateSecret();
    const time = Date.now();
    const code = generateTotp(secret, time);

    // Act: 5 minutos despues, ya no deberia ser valido
    const valido = verifyTotp(secret, code, time + 5 * 60_000);

    // Assert
    expect(valido).toBe(false);
  });

  it("rechaza codigo vacio o nulo", () => {
    // Arrange
    const secret = generateSecret();

    // Act & Assert
    expect(verifyTotp(secret, "")).toBe(false);
    expect(verifyTotp(secret, null)).toBe(false);
    expect(verifyTotp(secret, undefined)).toBe(false);
  });

  it("construye una URI otpauth valida", () => {
    // Act
    const uri = buildOtpAuthUri("SECRETOBASE32", "cliente@demo.local");

    // Assert
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=SECRETOBASE32");
    expect(uri).toContain(encodeURIComponent("cliente@demo.local"));
  });
});
