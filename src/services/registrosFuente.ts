import {
    FUENTES
} from "../config/sourceSchemas";

import type {
    CodigoFuente,
    FuenteConocida
} from "../config/sourceSchemas";

import {
    CAMPO_EXTRA
} from "../models/ExcelAnalysis";

import {
    limpiarIdDocumento,
    normalizarIdMantenimiento,
    normalizarIdTramite,
    obtenerClaveRegistro
} from "../utils/identificadores";


/*
 * Modelo v3: cada fila de cada Excel es un documento
 * propio, identificado por su clave dentro de su fuente
 * (DT_3558, CQ_BNCM00172413, LS_BNA-REQ-129).
 *
 * Así ninguna fuente pisa a otra, y varias filas que
 * comparten mantenimiento se conservan todas. El cruce
 * entre fuentes se hace al leer (consolidacionService).
 */
export const COLLECTION_REGISTROS =
    "registros_fuente_v3";

export const COLLECTION_CARGAS =
    "cargas_v3";

export const COLLECTION_CONFIGURACION =
    "configuracion_v3";

export const COLLECTION_CAMBIOS =
    "cambios_v3";

export const TAMANO_BATCH =
    400;


export interface RegistroFuente {
    idDocumento: string;
    fuente: FuenteConocida;
    codigoFuente: CodigoFuente;
    clave: string;
    idMantenimiento: string | null;
    idTramite: string | null;
    nombre: string;
    estado: string;
    datos: Record<string, unknown>;
    extra: Record<string, unknown>;
    activo: boolean;
}


function texto(
    valor: unknown
): string {
    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor).trim();
}


/*
 * Firestore no acepta undefined.
 */
function limpiarValores(
    registro: Record<string, unknown>
): Record<string, unknown> {
    const limpio:
        Record<string, unknown> = {};

    for (const [clave, valor] of Object.entries(registro)) {
        limpio[clave] =
            valor === undefined
                ? null
                : valor;
    }

    return limpio;
}


export function obtenerIdConfiguracion(
    fuente: FuenteConocida
): string {
    return `baseline_${FUENTES[fuente].codigo.toLowerCase()}`;
}


export function obtenerIdDocumento(
    registro: Record<string, unknown>,
    fuente: FuenteConocida
): string {
    const configuracion =
        FUENTES[fuente];

    const clave =
        obtenerClaveRegistro(
            registro,
            configuracion.camposClave
        );

    if (!clave) {
        throw new Error(
            `Se encontró un registro de ${configuracion.nombre} sin ${configuracion.nombreClave}.`
        );
    }

    return limpiarIdDocumento(
        `${configuracion.codigo}_${clave}`
    );
}


/*
 * Separa lo que viene del analizador en campos del
 * esquema (datos) y columnas adicionales (extra).
 */
export function separarRegistro(
    registro: Record<string, unknown>
): {
    datos: Record<string, unknown>;
    extra: Record<string, unknown>;
} {
    const {
        [CAMPO_EXTRA]: extra,
        ...datos
    } = registro;

    return {
        datos:
            limpiarValores(datos),
        extra:
            extra && typeof extra === "object"
                ? limpiarValores(extra as Record<string, unknown>)
                : {}
    };
}


/*
 * Lo que se compara entre cargas: todos los campos
 * del Excel, mapeados y adicionales.
 */
export function contenidoComparable(
    datos: Record<string, unknown>,
    extra: Record<string, unknown>
): Record<string, unknown> {
    return {
        ...datos,
        [CAMPO_EXTRA]: extra
    };
}


export function construirRegistroFuente(
    registro: Record<string, unknown>,
    fuente: FuenteConocida
): RegistroFuente {
    const configuracion =
        FUENTES[fuente];

    const {
        datos,
        extra
    } = separarRegistro(registro);

    return {
        idDocumento:
            obtenerIdDocumento(
                registro,
                fuente
            ),
        fuente,
        codigoFuente:
            configuracion.codigo,
        clave:
            obtenerClaveRegistro(
                registro,
                configuracion.camposClave
            ),
        idMantenimiento:
            normalizarIdMantenimiento(
                datos[configuracion.campoMantenimiento]
            ),
        idTramite:
            configuracion.campoTramite
                ? normalizarIdTramite(
                    datos[configuracion.campoTramite]
                )
                : null,
        nombre:
            texto(
                datos[configuracion.campoNombre]
            ),
        estado:
            texto(
                datos[configuracion.campoEstado]
            ),
        datos,
        extra,
        activo:
            true
    };
}


/*
 * Campos del documento de Firestore (sin metadatos
 * de carga).
 */
export function datosDocumento(
    registro: RegistroFuente
): Record<string, unknown> {
    return {
        id_registro:
            registro.idDocumento,
        fuente:
            registro.fuente,
        codigo_fuente:
            registro.codigoFuente,
        clave:
            registro.clave,
        id_mantenimiento:
            registro.idMantenimiento,
        id_tramite:
            registro.idTramite,
        nombre:
            registro.nombre,
        estado:
            registro.estado,
        datos:
            registro.datos,
        extra:
            registro.extra,
        activo:
            true
    };
}


/*
 * Lectura de un documento de Firestore.
 */
export function leerRegistroFuente(
    idDocumento: string,
    data: Record<string, unknown>
): RegistroFuente | null {
    const fuente =
        data.fuente as FuenteConocida;

    if (!(fuente in FUENTES)) {
        return null;
    }

    const objeto = (
        valor: unknown
    ): Record<string, unknown> =>
        valor && typeof valor === "object"
            ? valor as Record<string, unknown>
            : {};

    return {
        idDocumento,
        fuente,
        codigoFuente:
            FUENTES[fuente].codigo,
        clave:
            texto(data.clave),
        idMantenimiento:
            texto(data.id_mantenimiento) || null,
        idTramite:
            texto(data.id_tramite) || null,
        nombre:
            texto(data.nombre),
        estado:
            texto(data.estado),
        datos:
            objeto(data.datos),
        extra:
            objeto(data.extra),
        activo:
            data.activo !== false
    };
}
