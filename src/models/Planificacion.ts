import type {
    CodigoFuente
} from "../config/sourceSchemas";


/*
 * Modelo de la vista de Planificación: un resumen de cada
 * requerimiento con sus fechas ya normalizadas y los
 * eventos de calendario que salen de esas fechas.
 */


// =========================================================
// ESTADO TEMPORAL
// =========================================================

/*
 * Vencido, Vence hoy y Próximo son los mismos niveles de
 * Alertas (alertasService.nivelVencimiento).
 */
export type EstadoTemporal =
    "VENCIDO" |
    "VENCE_HOY" |
    "PROXIMO" |
    "EN_PLAZO" |
    "FINALIZADO" |
    "SIN_PLANIFICACION" |
    "INFORMATIVO";


// =========================================================
// EVENTOS
// =========================================================

/*
 * Tipos de fecha que pueden aparecer en el calendario.
 * Para sumar otro (hitos, fechas de Listado...) basta con
 * agregarlo aquí y en TIPOS_EVENTO de planificacionService.
 */
export type TipoEvento =
    "INICIO_DESARROLLO" |
    "FIN_DESARROLLO" |
    "INICIO_PLAN_CQ" |
    "FIN_PLAN_CQ" |
    "ASIGNACION_CQ";

/*
 * Grupos del control "Mostrar eventos".
 */
export type GrupoEvento =
    "FIN_DESARROLLO" |
    "INICIO_DESARROLLO" |
    "CLEARQUEST" |
    "ASIGNACION";


export interface PlanificacionEvento {
    /*
     * Único por requerimiento y tipo: un requerimiento no
     * puede tener dos eventos del mismo tipo.
     */
    id: string;
    tipo: TipoEvento;
    fecha: Date;
    requerimiento: PlanificacionRequerimiento;
}


// =========================================================
// PROBLEMAS DE PLANIFICACIÓN
// =========================================================

export type TipoProblema =
    "SIN_FECHAS" |
    "SIN_FIN" |
    "SIN_INICIO" |
    "FECHA_INVALIDA" |
    "INICIO_POSTERIOR" |
    "SIN_DT";


export interface ProblemaPlanificacion {
    idRequerimiento: string;
    tipoProblema: TipoProblema;
    descripcion: string;
}


// =========================================================
// REQUERIMIENTO PLANIFICADO
// =========================================================

export interface PlanificacionRequerimiento {
    /*
     * Id del requerimiento consolidado (ruta del detalle).
     */
    id: string;

    idMantenimiento: string;
    idTramite: string;
    idDemanda: string;
    idHistorico: string;

    /*
     * ID para mostrar: mantenimiento, trámite o demanda.
     */
    codigo: string;

    nombre: string;
    estado: string;
    responsable: string;
    categoria: string;
    recurso: string;
    fuentes: CodigoFuente[];

    /*
     * "DT + Listado + CQ", "Solo DT"...
     */
    cobertura: string;

    /*
     * Comienzo y Fin Desarrollo de DT.
     */
    fechaInicio: Date | null;
    fechaFin: Date | null;

    /*
     * Fechas de ClearQuest (la más temprana de inicio y
     * asignación, la más tardía de fin entre sus
     * actividades).
     */
    inicioPlanCQ: Date | null;
    finPlanCQ: Date | null;
    asignacionCQ: Date | null;

    /*
     * Días hasta la fecha final (negativo = atraso). null
     * sin fecha final.
     */
    diasRestantes: number | null;

    estadoTemporal: EstadoTemporal;
    terminado: boolean;

    problemas: ProblemaPlanificacion[];

    /*
     * Texto en minúsculas para la búsqueda (IDs y nombre),
     * calculado una sola vez.
     */
    textoBusqueda: string;
}
