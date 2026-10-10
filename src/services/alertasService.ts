import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from "firebase/firestore";

import {
    db
} from "../firebase/firebase";

import {
    COLLECTION_CONFIGURACION
} from "./registrosFuente";

import type {
    Requerimiento
} from "./consolidacionService";

import type {
    Carga
} from "./auditoriaService";

import {
    aDiaCalendario,
    diasEntre
} from "../utils/fechas";


/*
 * Alertas de seguimiento por fecha final de desarrollo
 * (columna "Fin Desarrollo" de Demanda Táctica).
 *
 * Se calculan en el navegador cada vez que se cargan los
 * requerimientos: no se guardan, así que no se duplican
 * al entrar a la app y se recalculan solas después de
 * cada importación. Solo la configuración (días de
 * anticipación, estados) vive en Firestore.
 */


// =========================================================
// CONFIGURACIÓN
// =========================================================

export interface ConfiguracionAlertas {
    /*
     * "Próximo a vencer" cuando faltan estos días o menos.
     */
    diasAnticipacion: number;

    /*
     * "Fecha modificada recientemente" si una carga de
     * estos últimos días cambió la fecha final.
     */
    diasFechaModificada: number;

    /*
     * Estados TI en los que el desarrollo ya terminó (o se
     * descartó): no generan alertas de vencimiento. null =
     * usar la regla por defecto.
     */
    estadosDesarrolloTerminado: string[] | null;
}


export const CONFIGURACION_ALERTAS_POR_DEFECTO: ConfiguracionAlertas = {
    diasAnticipacion: 7,
    diasFechaModificada: 7,
    estadosDesarrolloTerminado: null
};


const ID_CONFIGURACION =
    "alertas";


/*
 * Regla por defecto según el catálogo de Estado TI de DT:
 * 04 Desarrollo Finalizado en adelante, salvo 10
 * Paralizado (el desarrollo sigue pendiente).
 */
export function esDesarrolloTerminadoPorDefecto(
    estado: string
): boolean {
    const texto =
        estado.toLowerCase();

    if (/paraliz/.test(texto)) {
        return false;
    }

    return /^0?[4-9]\b|finaliz|calidad|despliegue|producci|descart|cerrad|anulad/.test(texto);
}


export async function leerConfiguracionAlertas(): Promise<ConfiguracionAlertas> {
    const snapshot =
        await getDoc(doc(db, COLLECTION_CONFIGURACION, ID_CONFIGURACION));

    if (!snapshot.exists()) {
        return { ...CONFIGURACION_ALERTAS_POR_DEFECTO };
    }

    const datos =
        snapshot.data();

    const entero = (
        valor: unknown,
        defecto: number
    ): number =>
        typeof valor === "number" && Number.isFinite(valor) && valor >= 0
            ? Math.round(valor)
            : defecto;

    return {
        diasAnticipacion:
            entero(datos.dias_anticipacion, CONFIGURACION_ALERTAS_POR_DEFECTO.diasAnticipacion),
        diasFechaModificada:
            entero(datos.dias_fecha_modificada, CONFIGURACION_ALERTAS_POR_DEFECTO.diasFechaModificada),
        estadosDesarrolloTerminado:
            Array.isArray(datos.estados_desarrollo_terminado)
                ? datos.estados_desarrollo_terminado.map(String)
                : null
    };
}


export async function guardarConfiguracionAlertas(
    configuracion: ConfiguracionAlertas,
    actualizadoPor: string
): Promise<void> {
    await setDoc(
        doc(db, COLLECTION_CONFIGURACION, ID_CONFIGURACION),
        {
            dias_anticipacion: configuracion.diasAnticipacion,
            dias_fecha_modificada: configuracion.diasFechaModificada,
            estados_desarrollo_terminado: configuracion.estadosDesarrolloTerminado,
            actualizado_por: actualizadoPor,
            fecha_actualizacion: serverTimestamp()
        }
    );
}


// =========================================================
// CÁLCULO
// =========================================================

export type NivelAlerta =
    "VENCIDO" |
    "VENCE_HOY" |
    "PROXIMO";


export const NIVELES_ALERTA: Record<NivelAlerta, {
    nombre: string;
    titulo: string;
    severidad: "danger" | "warn" | "info";
    icono: string;
    orden: number;
}> = {
    VENCIDO: {
        nombre: "Vencido",
        titulo: "Desarrollo vencido",
        severidad: "danger",
        icono: "pi pi-times-circle",
        orden: 0
    },
    VENCE_HOY: {
        nombre: "Vence hoy",
        titulo: "Desarrollo vence hoy",
        severidad: "warn",
        icono: "pi pi-exclamation-circle",
        orden: 1
    },
    PROXIMO: {
        nombre: "Próximo a vencer",
        titulo: "Desarrollo próximo a vencer",
        severidad: "info",
        icono: "pi pi-clock",
        orden: 2
    }
};


export interface FechaModificada {
    anterior: Date | null;
    nuevo: Date | null;
    fechaCarga: Date | null;
    idCarga: string;
}


export interface AlertaDesarrollo {
    idRequerimiento: string;
    idMantenimiento: string;
    idTramite: string;
    nombre: string;
    estado: string;
    responsable: string;
    fechaFin: Date;

    /*
     * Días hasta la fecha final (negativo = días de
     * atraso).
     */
    dias: number;

    /*
     * null cuando el desarrollo ya terminó: solo puede
     * quedar el aviso de fecha modificada.
     */
    nivel: NivelAlerta | null;

    fechaModificada: FechaModificada | null;
}


/*
 * Cambios de "Fin Desarrollo" en las cargas de DT de los
 * últimos días, por documento (el más reciente gana).
 */
export function fechasModificadasRecientes(
    cargas: Carga[],
    dias: number,
    hoy = new Date()
): Map<string, FechaModificada> {
    const resultado =
        new Map<string, FechaModificada>();

    const recientes =
        cargas
            .filter(carga =>
                carga.codigoFuente === "DT" &&
                carga.fecha !== null &&
                diasEntre(carga.fecha, hoy) <= dias
            )
            .sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));

    for (const carga of recientes) {
        for (const cambio of carga.fechasFinModificadas) {
            if (!resultado.has(cambio.idDocumento)) {
                resultado.set(cambio.idDocumento, {
                    anterior: aDiaCalendario(cambio.anterior),
                    nuevo: aDiaCalendario(cambio.nuevo),
                    fechaCarga: carga.fecha,
                    idCarga: carga.id
                });
            }
        }
    }

    return resultado;
}


export function desarrolloTerminado(
    requerimiento: Requerimiento,
    configuracion: ConfiguracionAlertas
): boolean {
    const dt =
        requerimiento.demandaTactica;

    if (!dt) {
        return false;
    }

    // Si ya hay fecha real de fin, el desarrollo terminó.
    if (aDiaCalendario(dt.datos.fin_desarrollo_real)) {
        return true;
    }

    const estado =
        dt.estado;

    return configuracion.estadosDesarrolloTerminado
        ? configuracion.estadosDesarrolloTerminado.includes(estado)
        : esDesarrolloTerminadoPorDefecto(estado);
}


/*
 * Solo los requerimientos con fecha final de desarrollo
 * registrada pueden tener alerta.
 */
export function calcularAlertas(
    requerimientos: Requerimiento[],
    configuracion: ConfiguracionAlertas,
    modificadas: Map<string, FechaModificada>,
    hoy = new Date()
): AlertaDesarrollo[] {
    const alertas: AlertaDesarrollo[] = [];

    for (const requerimiento of requerimientos) {
        const dt =
            requerimiento.demandaTactica;

        const fechaFin =
            aDiaCalendario(dt?.datos.fin_desarrollo);

        if (!dt || !fechaFin) {
            continue;
        }

        const dias =
            diasEntre(hoy, fechaFin);

        let nivel: NivelAlerta | null =
            null;

        if (!desarrolloTerminado(requerimiento, configuracion)) {
            if (dias < 0) {
                nivel = "VENCIDO";
            } else if (dias === 0) {
                nivel = "VENCE_HOY";
            } else if (dias <= configuracion.diasAnticipacion) {
                nivel = "PROXIMO";
            }
        }

        const fechaModificada =
            modificadas.get(dt.idDocumento) ?? null;

        if (!nivel && !fechaModificada) {
            continue;
        }

        alertas.push({
            idRequerimiento: requerimiento.id,
            idMantenimiento: requerimiento.idMantenimiento,
            idTramite: requerimiento.idTramite,
            nombre: requerimiento.nombre,
            estado: requerimiento.estado,
            responsable: requerimiento.responsable,
            fechaFin,
            dias,
            nivel,
            fechaModificada
        });
    }

    return alertas.sort((a, b) =>
        (a.nivel ? NIVELES_ALERTA[a.nivel].orden : 9) - (b.nivel ? NIVELES_ALERTA[b.nivel].orden : 9) ||
        a.dias - b.dias
    );
}


/*
 * "Faltan 5 días", "Vence hoy", "Venció hace 3 días".
 */
export function textoDias(
    dias: number
): string {
    if (dias === 0) return "Vence hoy";
    if (dias === 1) return "Falta 1 día";
    if (dias > 1) return `Faltan ${dias} días`;
    if (dias === -1) return "Venció hace 1 día";

    return `Venció hace ${-dias} días`;
}
