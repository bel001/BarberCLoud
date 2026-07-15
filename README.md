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

## Cuentas demo locales

Estas credenciales existen únicamente dentro del stack Docker local y no deben reutilizarse en AWS:

cliente@barbercloud.com      / BarberCloud2026!
secretaria@barbercloud.com   / BarberCloud2026!
barbero@barbercloud.com      / BarberCloud2026!
admin@barbercloud.com        / BarberCloud2026!

## Despliegue AWS

Requisitos:

- AWS CLI autenticado.
- Terraform >= 1.5.
- Node.js 24 para ejecutar pruebas y herramientas locales.
- Correo remitente real para verificar en SES.
- Backend remoto creado con `iac/bootstrap`.

Comandos:

```bash
npm -C backend ci --omit=dev
cp iac/backend.hcl.example iac/backend.hcl
cp iac/environments/dev.tfvars.example iac/environments/dev.tfvars
terraform -chdir=iac init -backend-config=backend.hcl
terraform -chdir=iac fmt -check -recursive
terraform -chdir=iac validate
terraform -chdir=iac plan -var-file=environments/dev.tfvars
terraform -chdir=iac apply -var-file=environments/dev.tfvars
```

Después del `apply`, cargar datos base:

```bash
export TABLE_NAME=$(terraform -chdir=iac output -raw dynamodb_table)
npm -C backend run seed
```

La preparación del estado remoto, SES, GitHub Environments y la promoción `develop` → `main` se documentan en [`docs/despliegue-aws.md`](docs/despliegue-aws.md). Los usuarios demo de Cognito están prohibidos en producción y requieren ambiente y contraseña explícitos.

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
