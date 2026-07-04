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

## Pruebas automatizadas

Comandos:

```bash
npm -C backend test
npm -C backend test:coverage
```

El backend usa Vitest con dos enfoques:

- Unitarias: prueban funciones puras de disponibilidad, finanzas y validaciones sin depender de AWS.
- Integracion con mocks: prueban el flujo entre servicios y handlers usando repositorios, auditoria y notificaciones simuladas.

Las pruebas siguen Arrange / Act / Assert para dejar claro que se prepara el escenario, se ejecuta la accion y se valida el resultado.

La cobertura se genera en `backend/coverage/lcov.info` para SonarQube Cloud. El proyecto exige umbrales minimos en Vitest:

- 80% statements.
- 70% branches.
- 80% functions.
- 80% lines.

## Cuentas demo

cliente@barbercloud.com      / BarberCloud2026!
secretaria@barbercloud.com   / BarberCloud2026!
barbero@barbercloud.com      / BarberCloud2026!
admin@barbercloud.com        / BarberCloud2026!

## Despliegue AWS

Requisitos:

- AWS CLI autenticado.
- Terraform >= 1.5.
- Node.js 20.
- Correo remitente verificado en SES para enviar notificaciones reales.

Comandos:

```bash
npm -C backend ci --omit=dev
terraform -chdir=iac init
terraform -chdir=iac fmt -check -recursive
terraform -chdir=iac validate
terraform -chdir=iac plan
terraform -chdir=iac apply
```

Después del `apply`, cargar datos base:

```bash
export TABLE_NAME=$(terraform -chdir=iac output -raw dynamodb_table)
npm -C backend run seed
```

Crear usuarios demo en Cognito:

```bash
export USER_POOL_ID=$(terraform -chdir=iac output -raw user_pool_id)
export DEMO_PASSWORD='BarberCloud2026!'
npm -C backend run create-demo-users
```

Outputs principales:

```bash
terraform -chdir=iac output frontend_url
terraform -chdir=iac output api_disponibilidad_url
terraform -chdir=iac output api_reserva_url
terraform -chdir=iac output api_cancelar_url
terraform -chdir=iac output api_barbero_url
terraform -chdir=iac output api_secretaria_url
terraform -chdir=iac output api_administrador_url
terraform -chdir=iac output cognito_domain
```

## Arquitectura implementada

- Cliente, barbero, secretaria y administrador con rutas separadas.
- Amazon Cognito con grupos `CLIENTE`, `BARBERO`, `SECRETARIA` y `ADMIN`.
- Seis APIs HTTP en API Gateway: disponibilidad, reserva, cancelacion, barbero, secretaria y administrador.
- Lambdas para reservas, cancelaciones, disponibilidad, agenda, insumos, clientes, POS, inventario, personal, finanzas, reglas de negocio, consumers y notificaciones.
- DynamoDB single-table con GSI, modo `PAY_PER_REQUEST` y point-in-time recovery.
- EventBridge para tareas programadas de disponibilidad y administracion.
- SNS para fan-out de disponibilidad y eventos de reserva/cancelacion.
- SQS como respaldo de notificaciones.
- SES para correos al cliente.
- SSM Parameter Store para configuracion compartida.
- CloudWatch Logs para funciones Lambda.
- Frontend publicado en S3 privado y servido por CloudFront HTTPS.
- GitHub Actions para SonarQube, Terraform y Checkov.
