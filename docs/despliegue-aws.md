# Despliegue seguro en AWS

## 1. Crear el backend remoto

El bootstrap se ejecuta una sola vez desde una estación administradora:

```bash
AWS_PROFILE=rrdev terraform -chdir=iac/bootstrap init
AWS_PROFILE=rrdev terraform -chdir=iac/bootstrap plan
AWS_PROFILE=rrdev terraform -chdir=iac/bootstrap apply
```

Obtén los nombres creados:

```bash
terraform -chdir=iac/bootstrap output -raw state_bucket
terraform -chdir=iac/bootstrap output -raw lock_table
terraform -chdir=iac/bootstrap output -json github_deploy_role_arns
terraform -chdir=iac/bootstrap output -raw cloudfront_origin_access_control_id
```

El bootstrap crea el proveedor OIDC de GitHub, un rol independiente por environment y un OAC compartido de CloudFront. Cada rol confía únicamente en su propio `sub` (`dev` o `prod`), accede solo a la clave de estado de ese ambiente y administra recursos con su prefijo o etiqueta. Si la cuenta ya tiene registrado `token.actions.githubusercontent.com`, importa ese proveedor al estado del bootstrap antes del primer `apply`.

Crea `iac/backend.hcl` a partir de `iac/backend.hcl.example`, reemplaza el ID de cuenta y usa una clave distinta por ambiente. Para migrar un estado local existente:

```bash
terraform -chdir=iac init -migrate-state -backend-config=backend.hcl
```

## 2. Configurar SES

`ses_sender_email` no acepta correos de ejemplo. El primer despliegue crea la identidad SES y se detiene para que se confirme el mensaje de verificación. Después de verificarlo, vuelve a ejecutar el workflow.

Para enviar a destinatarios no verificados, solicita a AWS la salida del sandbox de SES en la misma región del proyecto.

## 3. Configurar GitHub Environments

Crea los ambientes `dev` y `prod` con estas variables:

| Variable | Ejemplo |
|---|---|
| `AWS_REGION` | `us-east-1` |
| `AWS_DEPLOY_ROLE_ARN` | valor `dev` o `prod` de `github_deploy_role_arns`, configurado en el environment correspondiente |
| `TF_STATE_BUCKET` | salida `state_bucket` del bootstrap |
| `TF_LOCK_TABLE` | salida `lock_table` del bootstrap |
| `CLOUDFRONT_ORIGIN_ACCESS_CONTROL_ID` | salida `cloudfront_origin_access_control_id` del bootstrap |
| `SES_SENDER_EMAIL` | correo real que será verificado |

Cada rol OIDC queda limitado al repositorio `bel001/BarberCLoud` y a un solo ambiente. Producción requiere aprobación en el GitHub Environment `prod`; una ejecución `dev` no puede leer el estado ni administrar los recursos con prefijo `prod`.

Cuando `dev` esté completamente configurado, activa el despliegue automático:

```bash
gh variable set AWS_DEPLOY_ENABLED --repo bel001/BarberCLoud --body true
```

Mientras el valor sea `false`, el workflow solo se ejecuta manualmente.

## 4. Promoción

- Un Pull Request aprobado hacia `develop` ejecuta CI y, cuando esté habilitado, despliega `dev`.
- La promoción a producción se hace mediante Pull Request `develop` hacia `main`.
- Desde `main`, ejecuta manualmente `Despliegue AWS` seleccionando `prod`.
- El workflow verifica SES, aplica Terraform, invalida CloudFront y ejecuta smoke tests.

## 5. Usuarios demo temporales

No ejecutes el provisionador en producción. Para un ambiente temporal:

```bash
export DEMO_ENVIRONMENT=dev
export USER_POOL_ID=$(terraform -chdir=iac output -raw user_pool_id)
export TABLE_NAME=$(terraform -chdir=iac output -raw dynamodb_table)
read -rsp 'Contraseña temporal: ' DEMO_PASSWORD
export DEMO_PASSWORD
export INCLUDE_DEMO_ADMIN=false
npm -C backend run create-demo-users
```

La cuenta administrativa demo solo se crea cuando `INCLUDE_DEMO_ADMIN=true` se define explícitamente.
