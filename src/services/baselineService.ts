import {
    collection,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    writeBatch
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import type { FuenteDatos } from "../config/sourceSchemas";

const COLLECTION_REQUERIMIENTOS = "requerimientos_v2";
const COLLECTION_CARGAS = "cargas_v2";
const COLLECTION_CONFIGURACION = "configuracion_v2";

function limpiarTextoId(valor: unknown): string {
    if (valor === null || valor === undefined) return "";

    return String(valor)
        .trim()
        .toUpperCase();
}

function limpiarIdDocumento(valor: string): string {
    return valor
        .trim()
        .replace(/\//g, "-");
}

function limpiarRegistro(
    registro: Record<string, unknown>
): Record<string, unknown> {

    const limpio: Record<string, unknown> = {};

    for (const [clave, valor] of Object.entries(registro)) {
        limpio[clave] =
            valor === undefined
                ? null
                : valor;
    }

    return limpio;
}

function obtenerIdDocumento(
    registro: Record<string, unknown>,
    fuente: FuenteDatos
): string {

    if (fuente === "DEMANDA_TACTICA") {

        const idMantenimiento =
            limpiarTextoId(
                registro.id_mantenimiento
            );

        if (idMantenimiento) {
            return limpiarIdDocumento(
                idMantenimiento
            );
        }

        const idDemanda =
            limpiarTextoId(
                registro.id_demanda
            );

        if (idDemanda) {
            return limpiarIdDocumento(
                `DT_${idDemanda}`
            );
        }

        throw new Error(
            "Se encontró un registro de Demanda Táctica sin identificador."
        );
    }

    if (fuente === "CLEARQUEST") {

        const idMantenimiento =
            limpiarTextoId(
                registro.id_mantenimiento
            );

        if (!idMantenimiento) {
            throw new Error(
                "Se encontró un registro de ClearQuest sin ID Mantenimiento."
            );
        }

        return limpiarIdDocumento(
            idMantenimiento
        );
    }

    throw new Error(
        "No se puede guardar una fuente desconocida."
    );
}

function construirDatosDocumento(
    registro: Record<string, unknown>,
    fuente: FuenteDatos,
    idCarga: string
): Record<string, unknown> {

    const registroLimpio =
        limpiarRegistro(registro);

    if (fuente === "DEMANDA_TACTICA") {

        return {
            id_demanda:
                registro.id_demanda ?? null,

            id_mantenimiento:
                registro.id_mantenimiento ?? null,

            nombre_requerimiento:
                registro.nombre_requerimiento ?? null,

            en_demanda_tactica:
                true,

            activo_demanda_tactica:
                true,

            demanda_tactica:
            registroLimpio,

            ultima_carga_demanda_tactica:
            idCarga,

            fecha_actualizacion_demanda_tactica:
                serverTimestamp(),

            ultima_fuente_importada:
                "DEMANDA_TACTICA",

            fecha_ultima_importacion:
                serverTimestamp()
        };
    }

    if (fuente === "CLEARQUEST") {

        return {
            id_mantenimiento:
                registro.id_mantenimiento ?? null,

            en_clearquest:
                true,

            activo_clearquest:
                true,

            clearquest:
            registroLimpio,

            ultima_carga_clearquest:
            idCarga,

            fecha_actualizacion_clearquest:
                serverTimestamp(),

            ultima_fuente_importada:
                "CLEARQUEST",

            fecha_ultima_importacion:
                serverTimestamp()
        };
    }

    throw new Error(
        "No existe una estrategia de guardado para la fuente."
    );
}

function obtenerIdConfiguracionBaseline(
    fuente: FuenteDatos
): string {

    switch (fuente) {

        case "DEMANDA_TACTICA":
            return "baseline_demanda_tactica";

        case "CLEARQUEST":
            return "baseline_clearquest";

        default:
            throw new Error(
                "No existe configuración para una fuente desconocida."
            );
    }
}

export async function establecerBaseline(
    registros: Record<string, unknown>[],
    archivoNombre: string,
    hoja: string,
    filaCabecera: number,
    fuente: FuenteDatos
) {

    if (fuente === "DESCONOCIDA") {
        throw new Error(
            "No se puede crear un baseline para una fuente desconocida."
        );
    }

    if (registros.length === 0) {
        throw new Error(
            "No existen registros para guardar."
        );
    }

    const idConfiguracion =
        obtenerIdConfiguracionBaseline(
            fuente
        );

    const configuracionRef =
        doc(
            db,
            COLLECTION_CONFIGURACION,
            idConfiguracion
        );

    const configuracionActual =
        await getDoc(
            configuracionRef
        );

    if (
        configuracionActual.exists() &&
        configuracionActual.data()?.inicializado === true
    ) {

        const nombreFuente =
            fuente === "DEMANDA_TACTICA"
                ? "Demanda Táctica"
                : "ClearQuest";

        throw new Error(
            `${nombreFuente} ya tiene una base inicial registrada.`
        );
    }

    const prefijoFuente =
        fuente === "DEMANDA_TACTICA"
            ? "dt"
            : "cq";

    const idCarga =
        `baseline_${prefijoFuente}_${Date.now()}`;

    const TAMANO_BATCH = 400;

    let guardados = 0;

    for (
        let inicio = 0;
        inicio < registros.length;
        inicio += TAMANO_BATCH
    ) {

        const grupo =
            registros.slice(
                inicio,
                inicio + TAMANO_BATCH
            );

        const batch =
            writeBatch(db);

        for (const registro of grupo) {

            const idDocumento =
                obtenerIdDocumento(
                    registro,
                    fuente
                );

            const referencia =
                doc(
                    db,
                    COLLECTION_REQUERIMIENTOS,
                    idDocumento
                );

            const datos =
                construirDatosDocumento(
                    registro,
                    fuente,
                    idCarga
                );

            batch.set(
                referencia,
                {
                    id_registro:
                    idDocumento,

                    ...datos
                },
                {
                    merge: true
                }
            );
        }

        await batch.commit();

        guardados +=
            grupo.length;
    }

    const cargaRef =
        doc(
            collection(
                db,
                COLLECTION_CARGAS
            ),
            idCarga
        );

    await setDoc(
        cargaRef,
        {
            id_carga:
            idCarga,

            tipo:
                "BASELINE",

            fuente,

            archivo:
            archivoNombre,

            hoja,

            fila_cabecera:
            filaCabecera,

            registros_total:
            registros.length,

            nuevos:
            registros.length,

            modificados:
                0,

            sin_cambios:
                0,

            inactivos:
                0,

            estado:
                "COMPLETADA",

            fecha_carga:
                serverTimestamp()
        }
    );

    await setDoc(
        configuracionRef,
        {
            inicializado:
                true,

            fuente,

            id_carga:
            idCarga,

            archivo:
            archivoNombre,

            registros:
            registros.length,

            hoja,

            fila_cabecera:
            filaCabecera,

            fecha:
                serverTimestamp()
        },
        {
            merge: true
        }
    );

    return {
        idCarga,
        fuente,
        guardados
    };
}
