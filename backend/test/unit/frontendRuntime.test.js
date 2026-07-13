import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function loadFrontendScript(relativePath, globals, exportedName) {
  const source = readFileSync(new URL(`../../../frontend/assets/js/${relativePath}`, import.meta.url), "utf8");
  const context = vm.createContext(globals);
  vm.runInContext(`${source}\nglobalThis.__exported = ${exportedName};`, context);
  return context.__exported;
}

describe("frontend en configuracion AWS", () => {
  it("usa el API de cancelaciones para reprogramar una reserva", () => {
    const API = loadFrontendScript("api.js", {
      BARBERCLOUD_CONFIG: {
        API_BASE_URL: "https://reserva.example",
        API_BASE_URLS: {
          reserva: "https://reserva.example",
          cancelar: "https://cancelar.example"
        }
      },
      fetch: vi.fn()
    }, "API");

    expect(API.baseFor("/reservas/res_1/reprogramar")).toBe("https://cancelar.example");
  });

  it("redirige el login a Cognito sin llamar al endpoint local", async () => {
    let submitHandler;
    const loginWithCognito = vi.fn();
    const fetchMock = vi.fn();
    const source = readFileSync(new URL("../../../frontend/assets/js/login.js", import.meta.url), "utf8");
    const context = vm.createContext({
      BARBERCLOUD_CONFIG: { AUTH_MODE: "cognito" },
      AUTH: { loginWithCognito },
      document: {
        getElementById(id) {
          if (id === "login-form") {
            return { addEventListener: (_event, handler) => { submitHandler = handler; } };
          }
          throw new Error(`Elemento inesperado: ${id}`);
        }
      },
      fetch: fetchMock
    });

    vm.runInContext(source, context);
    await submitHandler({ preventDefault: vi.fn() });

    expect(loginWithCognito).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decodifica JWT Base64URL sin relleno", () => {
    const AUTH = loadFrontendScript("auth.js", {
      URLSearchParams,
      atob,
      decodeURIComponent,
      fetch: vi.fn(),
      localStorage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
      window: { location: {} }
    }, "AUTH");
    const claims = { sub: "cliente-1", name: "José" };
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");

    expect(AUTH.decodeJwt(`header.${payload}.signature`)).toEqual(claims);
  });
});
