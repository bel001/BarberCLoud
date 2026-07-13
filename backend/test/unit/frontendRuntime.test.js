import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function loadFrontendScript(relativePath, globals, exportedName) {
  const source = readFileSync(new URL(`../../../frontend/assets/js/${relativePath}`, import.meta.url), "utf8");
  const context = vm.createContext(globals);
  vm.runInContext(`${source}\nglobalThis.__exported = ${exportedName};`, context);
  return context.__exported;
}

function createStorage() {
  const values = new Map();

  return {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn(key => values.delete(key))
  };
}

function cognitoGlobals() {
  return {
    BARBERCLOUD_CONFIG: {
      COGNITO_CLIENT_ID: "cliente-web",
      COGNITO_DOMAIN: "https://auth.example.com",
      REDIRECT_URI: "https://app.example.com/callback.html"
    },
    URLSearchParams,
    TextEncoder,
    Uint8Array,
    atob,
    btoa,
    crypto: webcrypto,
    decodeURIComponent,
    fetch: vi.fn(),
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    window: { location: { href: "", search: "" } },
    document: { getElementById: vi.fn() }
  };
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

  it("inicia Cognito con state y PKCE S256", async () => {
    const globals = cognitoGlobals();
    const AUTH = loadFrontendScript("auth.js", globals, "AUTH");

    await AUTH.loginWithCognito();

    const url = new URL(globals.window.location.href);
    const transaction = JSON.parse(globals.sessionStorage.getItem(AUTH.oauthStorageKey));
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("state")).toBe(transaction.state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await AUTH.sha256Base64Url(transaction.verifier));
    expect(transaction.verifier.length).toBeGreaterThanOrEqual(43);
  });

  it("intercambia el codigo Cognito con el verificador PKCE", async () => {
    const globals = cognitoGlobals();
    const AUTH = loadFrontendScript("auth.js", globals, "AUTH");
    await AUTH.loginWithCognito();
    const loginUrl = new URL(globals.window.location.href);
    const transaction = JSON.parse(globals.sessionStorage.getItem(AUTH.oauthStorageKey));
    const claims = { sub: "cliente-1", email: "cliente@example.com", "cognito:groups": ["CLIENTE"] };
    const idToken = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
    globals.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id_token: idToken, access_token: "access-token" })
    });
    globals.window.location.search = `?code=codigo&state=${encodeURIComponent(loginUrl.searchParams.get("state"))}`;

    await AUTH.handleCognitoCallback();

    const request = globals.fetch.mock.calls[0][1];
    expect(request.body.get("code_verifier")).toBe(transaction.verifier);
    expect(globals.sessionStorage.getItem(AUTH.oauthStorageKey)).toBeNull();
    expect(JSON.parse(globals.localStorage.getItem("barbercloud_session"))).toMatchObject({
      sub: "cliente-1",
      role: "CLIENTE"
    });
  });

  it("rechaza callback Cognito con state distinto", async () => {
    const globals = cognitoGlobals();
    const AUTH = loadFrontendScript("auth.js", globals, "AUTH");
    await AUTH.loginWithCognito();
    globals.window.location.search = "?code=codigo&state=estado-ajeno";

    await expect(AUTH.handleCognitoCallback()).rejects.toThrow("no es valida o expiro");
    expect(globals.fetch).not.toHaveBeenCalled();
  });
});
