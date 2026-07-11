import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { generateSecret, verifyTotp, buildOtpAuthUri } from "./lib/totp.js";

import { handler as disponibilidad } from "./handlers/consultarDisponibilidad.js";
import { handler as nuevaReserva } from "./handlers/nuevaReserva.js";
import { handler as misReservas } from "./handlers/misReservas.js";
import { handler as cancelarReserva } from "./handlers/cancelarReserva.js";
import { handler as reprogramarReserva } from "./handlers/reprogramarReserva.js";
import { handler as gestionClientes } from "./handlers/gestionClientes.js";
import { handler as gestionCuenta } from "./handlers/gestionCuenta.js";
import { handler as gestionRecompensas } from "./handlers/gestionRecompensas.js";
import { handler as agendaBarbero } from "./handlers/gestionAgendaBarbero.js";
import { handler as actualizarEstadoCita } from "./handlers/actualizarEstadoCita.js";
import { handler as reporteFinanciero } from "./handlers/gestionFinanciera.js";
import { handler as gestionInsumos } from "./handlers/gestionInsumos.js";
import { handler as gestionPOS } from "./handlers/gestionPOS.js";
import { handler as gestionCaja } from "./handlers/gestionCaja.js";
import { handler as gestionInventario } from "./handlers/gestionInventario.js";
import { handler as gestionPersonal } from "./handlers/gestionPersonal.js";
import { handler as gestionNegocio } from "./handlers/gestionNegocio.js";
import { handler as gestionConfigNegocio } from "./handlers/gestionConfigNegocio.js";
import { handler as gestionActividad } from "./handlers/gestionActividad.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const demoUsers = [
  { email: "cliente@barbercloud.com", password: "BarberCloud2026!", role: "CLIENTE", sub: "cliente-demo", name: "Cliente Demo" },
  { email: "secretaria@barbercloud.com", password: "BarberCloud2026!", role: "SECRETARIA", sub: "secretaria-demo", name: "Secretaria Demo" },
  { email: "barbero@barbercloud.com", password: "BarberCloud2026!", role: "BARBERO", sub: "barbero_carlos", name: "Carlos Barbero" },
  { email: "admin@barbercloud.com", password: "BarberCloud2026!", role: "ADMIN", sub: "admin-demo", name: "Administrador" }
];

function lambdaEvent(req, role = null, user = null) {
  return {
    body: Object.keys(req.body || {}).length ? JSON.stringify(req.body) : null,
    rawPath: req.path,
    queryStringParameters: req.query,
    pathParameters: req.params,
    requestContext: {
      http: {
        method: req.method
      },
      authorizer: {
        jwt: {
          claims: user ? {
            sub: user.sub,
            email: user.email,
            name: user.name,
            "cognito:groups": role || user.role
          } : {}
        }
      }
    }
  };
}

function authLocal(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = demoUsers.find(item => `local-${item.role}-${item.sub}` === token);

  if (!user) {
    return res.status(401).json({ error: "Sesion no valida" });
  }

  req.localUser = user;
  next();
}

async function sendLambda(res, result) {
  res.status(result.statusCode || 200).set(result.headers || {}).send(result.body);
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "barbercloud-backend" });
});

app.post("/dev/login", (req, res) => {
  const { email, password, codigo2fa } = req.body;

  const user = demoUsers.find(item => item.email === email && item.password === password);

  if (!user) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  if (user.twoFactorEnabled) {
    if (!codigo2fa) {
      return res.json({ requiere2fa: true });
    }

    if (!verifyTotp(user.twoFactorSecret, codigo2fa)) {
      return res.status(401).json({ error: "Código de verificación inválido" });
    }
  }

  res.json({
    token: `local-${user.role}-${user.sub}`,
    role: user.role,
    email: user.email,
    name: user.name
  });
});

app.post("/dev/register", (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "nombre, email y password son obligatorios" });
  }

  if (demoUsers.some(item => item.email === email)) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
  }

  const user = { email, password, role: "CLIENTE", sub: `cliente_${uuidv4()}`, name: nombre };
  demoUsers.push(user);

  res.status(201).json({
    token: `local-${user.role}-${user.sub}`,
    role: user.role,
    email: user.email,
    name: user.name
  });
});

app.post("/dev/cambiar-password", authLocal, (req, res) => {
  const { passwordActual, passwordNueva } = req.body;

  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: "passwordActual y passwordNueva son obligatorios" });
  }

  if (req.localUser.password !== passwordActual) {
    return res.status(401).json({ error: "La contraseña actual es incorrecta" });
  }

  req.localUser.password = passwordNueva;
  res.json({ message: "Contraseña actualizada correctamente" });
});

app.delete("/dev/cuenta", authLocal, (req, res) => {
  const index = demoUsers.findIndex(item => item === req.localUser);

  if (index !== -1) {
    demoUsers.splice(index, 1);
  }

  res.json({ message: "Cuenta eliminada correctamente" });
});

app.get("/dev/2fa/estado", authLocal, (req, res) => {
  res.json({ habilitado: Boolean(req.localUser.twoFactorEnabled) });
});

app.post("/dev/2fa/iniciar", authLocal, (req, res) => {
  const secret = generateSecret();
  req.localUser.pendingTwoFactorSecret = secret;

  res.json({
    secret,
    otpauthUri: buildOtpAuthUri(secret, req.localUser.email)
  });
});

app.post("/dev/2fa/confirmar", authLocal, (req, res) => {
  const { codigo } = req.body;

  if (!req.localUser.pendingTwoFactorSecret) {
    return res.status(400).json({ error: "Primero debes iniciar la activación del 2FA" });
  }

  if (!verifyTotp(req.localUser.pendingTwoFactorSecret, codigo)) {
    return res.status(401).json({ error: "Código de verificación inválido" });
  }

  req.localUser.twoFactorSecret = req.localUser.pendingTwoFactorSecret;
  req.localUser.twoFactorEnabled = true;
  delete req.localUser.pendingTwoFactorSecret;

  res.json({ message: "Verificación en dos pasos activada correctamente" });
});

app.post("/dev/2fa/desactivar", authLocal, (req, res) => {
  const { codigo } = req.body;

  if (!req.localUser.twoFactorEnabled) {
    return res.status(400).json({ error: "El 2FA no está activado" });
  }

  if (!verifyTotp(req.localUser.twoFactorSecret, codigo)) {
    return res.status(401).json({ error: "Código de verificación inválido" });
  }

  req.localUser.twoFactorEnabled = false;
  delete req.localUser.twoFactorSecret;

  res.json({ message: "Verificación en dos pasos desactivada" });
});

app.get("/cliente/cuenta", authLocal, async (req, res) => {
  await sendLambda(res, await gestionCuenta(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.put("/cliente/cuenta", authLocal, async (req, res) => {
  await sendLambda(res, await gestionCuenta(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/disponibilidad", async (req, res) => {
  await sendLambda(res, await disponibilidad(lambdaEvent(req)));
});

app.post("/reservas", authLocal, async (req, res) => {
  await sendLambda(res, await nuevaReserva(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/cliente/reservas", authLocal, async (req, res) => {
  await sendLambda(res, await misReservas(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/reservas/:id/cancelar", authLocal, async (req, res) => {
  await sendLambda(res, await cancelarReserva(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/reservas/:id/reprogramar", authLocal, async (req, res) => {
  await sendLambda(res, await reprogramarReserva(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/cliente/recompensas", authLocal, async (req, res) => {
  await sendLambda(res, await gestionRecompensas(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/cliente/recompensas", authLocal, async (req, res) => {
  await sendLambda(res, await gestionRecompensas(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/secretaria/reservas-presenciales", authLocal, async (req, res) => {
  await sendLambda(res, await gestionClientes(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/secretaria/clientes", authLocal, async (req, res) => {
  await sendLambda(res, await gestionClientes(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/secretaria/clientes", authLocal, async (req, res) => {
  await sendLambda(res, await gestionClientes(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/secretaria/clientes/:id/historial", authLocal, async (req, res) => {
  await sendLambda(res, await gestionClientes(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/secretaria/agenda", authLocal, async (req, res) => {
  await sendLambda(res, await agendaBarbero(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/secretaria/pos", authLocal, async (req, res) => {
  await sendLambda(res, await gestionPOS(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/secretaria/pos", authLocal, async (req, res) => {
  await sendLambda(res, await gestionPOS(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/secretaria/caja/abrir", authLocal, async (req, res) => {
  await sendLambda(res, await gestionCaja(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/secretaria/caja/cerrar", authLocal, async (req, res) => {
  await sendLambda(res, await gestionCaja(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/secretaria/inventario", authLocal, async (req, res) => {
  await sendLambda(res, await gestionInventario(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/secretaria/inventario", authLocal, async (req, res) => {
  await sendLambda(res, await gestionInventario(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/barbero/agenda", authLocal, async (req, res) => {
  await sendLambda(res, await agendaBarbero(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.put("/barbero/turno", authLocal, async (req, res) => {
  await sendLambda(res, await agendaBarbero(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/barbero/citas/:id/estado", authLocal, async (req, res) => {
  await sendLambda(res, await actualizarEstadoCita(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/barbero/insumos", authLocal, async (req, res) => {
  await sendLambda(res, await gestionInsumos(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/barbero/insumos", authLocal, async (req, res) => {
  await sendLambda(res, await gestionInsumos(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/reporte-financiero", authLocal, async (req, res) => {
  await sendLambda(res, await reporteFinanciero(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/personal", authLocal, async (req, res) => {
  await sendLambda(res, await gestionPersonal(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/admin/personal", authLocal, async (req, res) => {
  await sendLambda(res, await gestionPersonal(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/admin/personal/:id/baja", authLocal, async (req, res) => {
  await sendLambda(res, await gestionPersonal(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/servicios", authLocal, async (req, res) => {
  await sendLambda(res, await gestionNegocio(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/admin/servicios", authLocal, async (req, res) => {
  await sendLambda(res, await gestionNegocio(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/agenda", authLocal, async (req, res) => {
  await sendLambda(res, await agendaBarbero(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/insumos", authLocal, async (req, res) => {
  await sendLambda(res, await gestionInsumos(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/inventario", authLocal, async (req, res) => {
  await sendLambda(res, await gestionInventario(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/admin/inventario", authLocal, async (req, res) => {
  await sendLambda(res, await gestionInventario(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/pos", authLocal, async (req, res) => {
  await sendLambda(res, await gestionPOS(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/dashboard-financiero", authLocal, async (req, res) => {
  await sendLambda(res, await reporteFinanciero(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.post("/admin/citas/:id/estado", authLocal, async (req, res) => {
  await sendLambda(res, await actualizarEstadoCita(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/config-negocio", authLocal, async (req, res) => {
  await sendLambda(res, await gestionConfigNegocio(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.put("/admin/config-negocio", authLocal, async (req, res) => {
  await sendLambda(res, await gestionConfigNegocio(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/actividad", authLocal, async (req, res) => {
  await sendLambda(res, await gestionActividad(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.listen(PORT, () => {
  console.log(`BarberCloud backend local en puerto ${PORT}`);
});
