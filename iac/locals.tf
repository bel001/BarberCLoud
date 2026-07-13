locals {
  prefix = "${var.project_name}-${var.environment}"

  lambda_handlers = {
    consultar_disponibilidad = "src/handlers/consultarDisponibilidad.handler"
    catalogo_publico         = "src/handlers/publicCatalog.handler"
    cuenta_cliente           = "src/handlers/gestionCuentaCliente.handler"
    reservas_cliente         = "src/handlers/gestionReservasCliente.handler"
    cancelar_reserva         = "src/handlers/cancelarReserva.handler"
    agenda_barbero           = "src/handlers/gestionAgendaBarbero.handler"
    insumos_barbero          = "src/handlers/gestionInsumos.handler"
    clientes                 = "src/handlers/gestionClientes.handler"
    agenda_global            = "src/handlers/gestionAgendaGlobal.handler"
    pos                      = "src/handlers/gestionPOS.handler"
    inventario               = "src/handlers/gestionInventario.handler"
    personal                 = "src/handlers/gestionPersonal.handler"
    financiera               = "src/handlers/gestionFinanciera.handler"
    negocio                  = "src/handlers/gestionNegocio.handler"
    dashboard                = "src/handlers/gestionDashboard.handler"
    auditoria                = "src/handlers/gestionAuditoria.handler"
    manage_services          = "src/handlers/manageServices.handler"
    notificar_reserva        = "src/handlers/notificarReserva.handler"
    notificar_cancelacion    = "src/handlers/notificarCancelacion.handler"
  }
}
