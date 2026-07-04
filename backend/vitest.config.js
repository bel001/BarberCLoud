import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/services/**/*.js",
        "src/lib/audit.js",
        "src/lib/auth.js",
        "src/lib/notifications.js",
        "src/lib/response.js",
        "src/handlers/cancelarReserva.js",
        "src/handlers/consultarDisponibilidad.js",
        "src/handlers/gestionClientes.js",
        "src/handlers/gestionFinanciera.js",
        "src/handlers/gestionPOS.js",
        "src/handlers/nuevaReserva.js"
      ],
      exclude: [
        "src/local-server.js"
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      }
    }
  }
});
