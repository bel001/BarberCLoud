# BarberCloud

Sistema serverless de reservas para barberia basado en AWS.

## Flujo principal

- El visitante puede ver la pagina sin cuenta.
- Para confirmar una reserva debe iniciar sesion como cliente.
- La secretaria solo puede registrar citas presenciales para clientes registrados.
- El administrador puede acceder a funciones operativas y administrativas.

## Ejecutar localmente

Comando:

docker compose up --build

Frontend:

http://localhost:8080

Backend:

http://localhost:3001/health

## Cuentas demo

cliente@barbercloud.com      / BarberCloud2026!
secretaria@barbercloud.com   / BarberCloud2026!
barbero@barbercloud.com      / BarberCloud2026!
admin@barbercloud.com        / BarberCloud2026!
