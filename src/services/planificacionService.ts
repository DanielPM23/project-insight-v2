import type {
    Requerimiento
} from "./consolidacionService";

import {
    NIVELES_ALERTA,
    desarrolloTerminado,
    esDesarrolloTerminadoPorDefecto,
    fechaFinDesarrollo,
    nivelVencimiento
} from "./alertasService";

import type {
    ConfiguracionAlertas
} from "./alertasService";

import type {
    EstadoTemporal,
    GrupoEvento,
    PlanificacionEvento,
    PlanificacionRequerimiento,
    ProblemaPlanificacion,
    TipoEvento,
    TipoProblema
} from "../models/Planificacion";

import {
    aDiaCalendario,
    diasEntre,
    formatearFecha
} from "../utils/fechas";


/*
 * Planificación: cuándo ocurre el trabajo.
 *
 * Trabaja sobre los requerimientos consolidados que ya
 * están en el store (no lee Firestore otra vez) y sobre la
 * configuración de Alertas, para que el estado de
 * vencimiento sea el mismo en las dos vistas.
 *
 * Las fechas de desarrollo vienen de Demanda Táctica
 * (Comienzo / Fin Desarrollo); las de ClearQuest se
 * muestran solo como eventos informativos.
 */


// =========================================================
// CATÁLOGOS
// =========================================================

export const ESTADOS_TEMPORALES: Record<EstadoTemporal, {
    nombre: string;
    icono: string;

    /*
     * Clase CSS del color (pt-vencido, pt-hoy...).
     */
    clase: string;

    /*
     * Orden de "Próximos vencimientos": vencidos primero.
     */
    orden: number;
}> = {
    VENCIDO: {
        nombre: NIVELES_ALERTA.VENCIDO.nombre,
        icono: NIVELES_ALERTA.VENCIDO.icono,
        clase: "pt-vencido",
        orden: 0
    },
    VENCE_HOY: {
        nombre: NIVELES_ALERTA.VENCE_HOY.nombre,
        icono: NIVELES_ALERTA.VENCE_HOY.icono,
        clase: "pt-hoy",
        orden: 1
    },
    PROXIMO: {
        nombre: NIVELES_ALERTA.PROXIMO.nombre,
        icono: NIVELES_ALERTA.PROXIMO.icono,
        clase: "pt-proximo",
        orden: 2
    },
    EN_PLAZO: {
        nombre: "En plazo",
        icono: "pi pi-check-circle",
        clase: "pt-plazo",
        orden: 3
    },
    FINALIZADO: {
        nombre: "Finalizado",
        icono: "pi pi-flag",
        clase: "pt-finalizado",
        orden: 4
    },
    SIN_PLANIFICACION: {
        nombre: "Sin planificación",
        icono: "pi pi-question-circle",
        clase: "pt-sin",
        orden: 5
    },
    INFORMATIVO: {
        nombre: "Informativo",
        icono: "pi pi-info-circle",
        clase: "pt-info",
        orden: 6
    }
};


export const GRUPOS_EVENTO: Record<GrupoEvento, {
    nombre: string;
    porDefecto: boolean;
}> = {
    FIN_DESARROLLO: { nombre: "Fin de desarrollo", porDefecto: true },
    INICIO_DESARROLLO: { nombre: "Inicio de desarrollo", porDefecto: true },
    CLEARQUEST: { nombre: "Fechas ClearQuest (plan)", porDefecto: false },
    ASIGNACION: { nombre: "Asignaciones ClearQuest", porDefecto: false }
};


export const TIPOS_EVENTO: Record<TipoEvento, {
    nombre: string;

    /*
     * Etiqueta corta para la celda del calendario.
     */
    corto: string;
    icono: string;
    grupo: GrupoEvento;

    /*
     * Los eventos de fin llevan el color del estado
     * temporal; el resto son informativos.
     */
    principal: boolean;
    fecha: (item: PlanificacionRequerimiento) => Date | null;
}> = {
    FIN_DESARROLLO: {
        nombre: "Fin de desarrollo",
        corto: "Fin",
        icono: "pi pi-flag",
        grupo: "FIN_DESARROLLO",
        principal: true,
        fecha: item => item.fechaFin
    },
    INICIO_DESARROLLO: {
        nombre: "Inicio de desarrollo",
        corto: "Inicio",
        icono: "pi pi-play",
        grupo: "INICIO_DESARROLLO",
        principal: false,
        fecha: item => item.fechaInicio
    },
    INICIO_PLAN_CQ: {
        nombre: "Inicio plan ClearQuest",
        corto: "Inicio CQ",
        icono: "pi pi-play",
        grupo: "CLEARQUEST",
        principal: false,
        fecha: item => item.inicioPlanCQ
    },
    FIN_PLAN_CQ: {
        nombre: "Fin plan ClearQuest",
        corto: "Fin CQ",
        icono: "pi pi-flag",
        grupo: "CLEARQUEST",
        principal: false,
        fecha: item => item.finPlanCQ
    },
    ASIGNACION_CQ: {
        nombre: "Asignación ClearQuest",
        corto: "Asignación",
        icono: "pi pi-user-plus",
        grupo: "ASIGNACION",
        principal: false,
        fecha: item => item.asignacionCQ
    }
};


export const PROBLEMAS: Record<TipoProblema, string> = {
    SIN_FECHAS: "Sin fecha de inicio ni final",
    SIN_FIN: "Sin fecha final",
    SIN_INICIO: "Sin fecha de inicio",
    FECHA_INVALIDA: "Fecha inválida",
    INICIO_POSTERIOR: "Inicio posterior al fin",
    SIN_DT: "No está en Demanda Táctica"
};


// =========================================================
// FECHAS
// =========================================================

/*
 * Celdas que en los Excels significan "sin fecha".
 */
const SIN_VALOR =
    /^(-+|—|n\/?a|s\/?f|sin fecha|pendiente|por definir)$/i;


function tieneValor(
    valor: unknown
): boolean {
    if (valor === null || valor === undefined) {
        return false;
    }

    if (typeof valor === "string") {
        const texto = valor.trim();
        return texto !== "" && !SIN_VALOR.test(texto);
    }

    return true;
}


/*
 * Texto del valor original de una fecha que no se pudo
 * interpretar, para mostrarlo en el problema.
 */
function valorOriginal(
    valor: unknown
): string {
    if (valor instanceof Date) {
        return Number.isNaN(valor.getTime()) ? "fecha vacía" : valor.toLocaleDateString("es-PE");
    }

    if (typeof valor === "object" && valor && typeof (valor as { toDate?: unknown }).toDate === "function") {
        return (valor as { toDate: () => Date }).toDate().toLocaleDateString("es-PE");
    }

    return String(valor);
}


interface FechaLeida {
    fecha: Date | null;

    /*
     * Hay un valor pero no es una fecha válida.
     */
    invalida: boolean;
    original: string;
}


function leerFecha(
    valor: unknown
): FechaLeida {
    const fecha =
        aDiaCalendario(valor);

    const invalida =
        !fecha && tieneValor(valor);

    return {
        fecha,
        invalida,
        original: invalida ? valorOriginal(valor) : ""
    };
}


/*
 * La más temprana (o la más tardía) de una fecha entre
 * las actividades de ClearQuest.
 */
function fechaClearQuest(
    requerimiento: Requerimiento,
    campo: string,
    criterio: "min" | "max"
): Date | null {
    let resultado: Date | null =
        null;

    for (const actividad of requerimiento.clearQuest) {
        const fecha =
            aDiaCalendario(actividad.datos[campo]);

        if (
            fecha &&
            (!resultado || (criterio === "min" ? fecha < resultado : fecha > resultado))
        ) {
            resultado = fecha;
        }
    }

    return resultado;
}


// =========================================================
// CONSTRUCCIÓN
// =========================================================

function problema(
    idRequerimiento: string,
    tipoProblema: TipoProblema,
    detalle = ""
): ProblemaPlanificacion {
    return {
        idRequerimiento,
        tipoProblema,
        descripcion: detalle
            ? `${PROBLEMAS[tipoProblema]}: ${detalle}`
            : PROBLEMAS[tipoProblema]
    };
}


/*
 * Problemas de un requerimiento activo de DT.
 */
function problemasDeFechas(
    id: string,
    inicio: FechaLeida,
    fin: FechaLeida
): ProblemaPlanificacion[] {
    const problemas: ProblemaPlanificacion[] = [];

    if (inicio.invalida) {
        problemas.push(problema(id, "FECHA_INVALIDA", `inicio "${inicio.original}"`));
    }

    if (fin.invalida) {
        problemas.push(problema(id, "FECHA_INVALIDA", `fin "${fin.original}"`));
    }

    const sinInicio =
        !inicio.fecha && !inicio.invalida;

    const sinFin =
        !fin.fecha && !fin.invalida;

    if (sinInicio && sinFin) {
        problemas.push(problema(id, "SIN_FECHAS"));
    } else if (sinFin) {
        problemas.push(problema(id, "SIN_FIN"));
    } else if (sinInicio) {
        problemas.push(problema(id, "SIN_INICIO"));
    }

    if (inicio.fecha && fin.fecha && inicio.fecha > fin.fecha) {
        problemas.push(problema(id, "INICIO_POSTERIOR", `${formatearFecha(inicio.fecha)} > ${formatearFecha(fin.fecha)}`));
    }

    return problemas;
}


function estadoTemporal(
    terminado: boolean,
    dias: number | null,
    configuracion: ConfiguracionAlertas
): EstadoTemporal {
    if (terminado) {
        return "FINALIZADO";
    }

    if (dias === null) {
        return "SIN_PLANIFICACION";
    }

    return nivelVencimiento(dias, configuracion) ?? "EN_PLAZO";
}


/*
 * Un resumen por requerimiento, con las fechas
 * normalizadas una sola vez.
 *
 * Las copias por casos del Listado comparten la fila de
 * DT: se omiten para no repetir sus eventos (igual que en
 * Alertas).
 */
export function construirPlanificacion(
    requerimientos: Requerimiento[],
    configuracion: ConfiguracionAlertas,
    hoy = new Date()
): PlanificacionRequerimiento[] {
    const resultado: PlanificacionRequerimiento[] = [];

    for (const requerimiento of requerimientos) {
        if (requerimiento.copiaDe) {
            continue;
        }

        const dt =
            requerimiento.demandaTactica;

        const inicio =
            leerFecha(dt?.datos.comienzo_desarrollo);

        const fin =
            leerFecha(dt?.datos.fin_desarrollo);

        // La misma fecha final que usa Alertas.
        const fechaFin =
            fechaFinDesarrollo(requerimiento);

        let terminado: boolean;
        let estado: EstadoTemporal;
        let problemas: ProblemaPlanificacion[] = [];

        const diasRestantes =
            fechaFin ? diasEntre(hoy, fechaFin) : null;

        if (dt) {
            terminado = desarrolloTerminado(requerimiento, configuracion);
            estado = estadoTemporal(terminado, diasRestantes, configuracion);

            if (!terminado) {
                problemas = problemasDeFechas(requerimiento.id, inicio, fin);
            }
        } else if (requerimiento.listado.length > 0) {
            /*
             * Caso del Listado que todavía no está en DT: no
             * tiene fechas de desarrollo que planificar.
             */
            terminado = esDesarrolloTerminadoPorDefecto(requerimiento.estado);
            estado = terminado ? "FINALIZADO" : "SIN_PLANIFICACION";

            if (!terminado) {
                problemas = [problema(requerimiento.id, "SIN_DT")];
            }
        } else {
            /*
             * Solo ClearQuest: historial de actividades, sin
             * planificación propia. Sus fechas solo se ven
             * como eventos informativos.
             */
            terminado = esDesarrolloTerminadoPorDefecto(requerimiento.estado);
            estado = terminado ? "FINALIZADO" : "INFORMATIVO";
        }

        resultado.push({
            id: requerimiento.id,
            idMantenimiento: requerimiento.idMantenimiento,
            idTramite: requerimiento.idTramite,
            idDemanda: requerimiento.idDemanda,
            idHistorico: requerimiento.idHistorico,
            codigo: requerimiento.idMantenimiento || requerimiento.idTramite || requerimiento.idDemanda || requerimiento.caso || requerimiento.id,
            nombre: requerimiento.nombre,
            estado: requerimiento.estado,
            responsable: requerimiento.responsable,
            categoria: requerimiento.categoria,
            recurso: requerimiento.recurso,
            fuentes: requerimiento.fuentes,
            cobertura: requerimiento.cobertura,
            fechaInicio: inicio.fecha,
            fechaFin,
            inicioPlanCQ: fechaClearQuest(requerimiento, "fecha_inicio_plan_cq", "min"),
            finPlanCQ: fechaClearQuest(requerimiento, "fecha_final_plan_cq", "max"),
            asignacionCQ: fechaClearQuest(requerimiento, "fecha_asignacion_cq", "min"),
            diasRestantes,
            estadoTemporal: estado,
            terminado,
            problemas,
            textoBusqueda: [
                requerimiento.idMantenimiento,
                requerimiento.idTramite,
                requerimiento.idDemanda,
                requerimiento.idHistorico,
                requerimiento.caso,
                requerimiento.nombre
            ]
                .join(" ")
                .toLowerCase()
        });
    }

    return resultado;
}


// =========================================================
// EVENTOS
// =========================================================

export interface RangoFechas {
    desde: Date;

    /*
     * Exclusivo, como el rango visible de FullCalendar.
     */
    hasta: Date;
}


/*
 * Eventos de los grupos elegidos. Con rango, solo los que
 * caen dentro (el calendario no recibe meses que no se
 * ven).
 */
export function generarEventos(
    items: PlanificacionRequerimiento[],
    grupos: ReadonlySet<GrupoEvento>,
    rango?: RangoFechas | null
): PlanificacionEvento[] {
    const tipos =
        (Object.keys(TIPOS_EVENTO) as TipoEvento[])
            .filter(tipo => grupos.has(TIPOS_EVENTO[tipo].grupo));

    const eventos: PlanificacionEvento[] = [];

    for (const item of items) {
        for (const tipo of tipos) {
            const fecha =
                TIPOS_EVENTO[tipo].fecha(item);

            if (!fecha || (rango && (fecha < rango.desde || fecha >= rango.hasta))) {
                continue;
            }

            eventos.push({
                id: `${item.id}|${tipo}`,
                tipo,
                fecha,
                requerimiento: item
            });
        }
    }

    return eventos;
}


/*
 * Estado que da color al evento: el temporal en los de
 * fin de desarrollo; informativo en el resto, salvo que
 * el desarrollo ya terminó.
 */
export function estadoDelEvento(
    evento: PlanificacionEvento
): EstadoTemporal {
    const estado =
        evento.requerimiento.estadoTemporal;

    if (TIPOS_EVENTO[evento.tipo].principal || estado === "FINALIZADO") {
        return estado;
    }

    return "INFORMATIVO";
}


// =========================================================
// LISTAS
// =========================================================

/*
 * Desarrollos sin terminar con fecha final: vencidos,
 * vencen hoy, próximos y en plazo, por fecha.
 */
export function proximosVencimientos(
    items: PlanificacionRequerimiento[]
): PlanificacionRequerimiento[] {
    return items
        .filter(item => !item.terminado && item.diasRestantes !== null)
        .sort((a, b) =>
            ESTADOS_TEMPORALES[a.estadoTemporal].orden - ESTADOS_TEMPORALES[b.estadoTemporal].orden ||
            (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0)
        );
}


/*
 * Requerimientos activos con la planificación incompleta.
 */
export function sinPlanificacion(
    items: PlanificacionRequerimiento[]
): PlanificacionRequerimiento[] {
    return items.filter(item => item.problemas.length > 0);
}


/*
 * Fecha de hoy como YYYY-MM-DD local (para FullCalendar y
 * la URL), sin pasar por UTC.
 */
export function fechaISO(
    fecha: Date
): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}


/*
 * Fecha de la URL (?fecha=2026-10-22) como día local.
 */
export function leerFechaISO(
    texto: unknown
): Date | null {
    if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return null;
    }

    const [anio, mes, dia] = texto.split("-").map(Number);
    const fecha = new Date(anio!, mes! - 1, dia!);

    return Number.isNaN(fecha.getTime()) ? null : fecha;
}
