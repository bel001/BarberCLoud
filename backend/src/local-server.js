import express from "express";
import cors from "cors";

import { handler as disponibilidad } from "./handlers/consultarDisponibilidad.js";
import { handler as nuevaReserva } from "./handlers/nuevaReserva.js";
import { handler as misReservas } from "./handlers/misReservas.js";
import { handler as cancelarReserva } from "./handlers/cancelarReserva.js";
import { handler as gestionClientes } from "./handlers/gestionClientes.js";
import { handler as agendaBarbero } from "./handlers/gestionAgendaBarbero.js";
import { handler as reporteFinanciero } from "./handlers/gestionFinanciera.js";

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
  const { email, password } = req.body;

  const user = demoUsers.find(item => item.email === email && item.password === password);

  if (!user) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  res.json({
    token: `local-${user.role}-${user.sub}`,
    role: user.role,
    email: user.email,
    name: user.name
  });
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

app.post("/secretaria/reservas-presenciales", authLocal, async (req, res) => {
  await sendLambda(res, await gestionClientes(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/barbero/agenda", authLocal, async (req, res) => {
  await sendLambda(res, await agendaBarbero(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.get("/admin/reporte-financiero", authLocal, async (req, res) => {
  await sendLambda(res, await reporteFinanciero(lambdaEvent(req, req.localUser.role, req.localUser)));
});

app.listen(PORT, () => {
  console.log(`BarberCloud backend local en puerto ${PORT}`);
});
