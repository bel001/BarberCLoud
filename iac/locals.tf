locals {
  name = var.project_name

  common_tags = {
    Project     = var.project_name
    Environment = "dev"
    ManagedBy   = "terraform"
  }

  lambda_functions = {
    consultar_disponibilidad = "src/handlers/consultarDisponibilidad.handler"
    nueva_reserva            = "src/handlers/nuevaReserva.handler"
    mis_reservas             = "src/handlers/misReservas.handler"
    cancelar_reserva         = "src/handlers/cancelarReserva.handler"
    gestion_clientes         = "src/handlers/gestionClientes.handler"
    gestion_agenda_barbero   = "src/handlers/gestionAgendaBarbero.handler"
    gestion_insumos          = "src/handlers/gestionInsumos.handler"
    gestion_pos              = "src/handlers/gestionPOS.handler"
    gestion_inventario       = "src/handlers/gestionInventario.handler"
    gestion_personal         = "src/handlers/gestionPersonal.handler"
    gestion_financiera       = "src/handlers/gestionFinanciera.handler"
    gestion_negocio          = "src/handlers/gestionNegocio.handler"
    manage_services          = "src/handlers/manageServices.handler"
    lambda_consumer_avail    = "src/handlers/lambdaConsumerAvail.handler"
    lambda_consumer_admin    = "src/handlers/lambdaConsumerAdmin.handler"
    notificar_reserva        = "src/handlers/notificarReserva.handler"
    notificar_cancelacion    = "src/handlers/notificarCancelacion.handler"
  }

  frontend_bucket_name = var.frontend_bucket_name != "" ? var.frontend_bucket_name : "${local.name}-frontend-${random_id.suffix.hex}"

  frontend_content_types = {
    css  = "text/css"
    html = "text/html"
    js   = "application/javascript"
    json = "application/json"
    map  = "application/json"
    png  = "image/png"
    svg  = "image/svg+xml"
    webp = "image/webp"
    jpg  = "image/jpeg"
    jpeg = "image/jpeg"
    ico  = "image/x-icon"
  }

  frontend_files = setsubtract(fileset("${path.module}/../frontend", "**"), ["assets/js/config.js"])
}

resource "random_id" "suffix" {
  byte_length = 4
}
