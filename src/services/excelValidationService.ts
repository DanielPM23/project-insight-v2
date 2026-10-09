import {
    FUENTES
} from "../config/sourceSchemas";

import type {
    FuenteDatos
} from "../config/sourceSchemas";

import {
    obtenerClaveRegistro
} from "../utils/identificadores";

export interface ResultadoValidacion {
    valido: boolean;
    totalRegistros: number;
    registrosValidos: number;
    registrosSinId: number;
    idsDuplicados: string[];
    campoIdentificador: string;

    errores: string[];
}

// =========================================================
// VALIDAR REGISTROS
// =========================================================

export function validarRegistrosExcel(
    registros: Record<string, unknown>[],
    fuente: FuenteDatos
): ResultadoValidacion {

    const errores: string[] = [];

    // =======================================================
    // VALIDAR FUENTE
    // =======================================================

    if (
        fuente === "DESCONOCIDA"
    ) {

        return {

            valido:
                false,

            totalRegistros:
            registros.length,

            registrosValidos:
                0,

            registrosSinId:
            registros.length,

            idsDuplicados:
                [],

            campoIdentificador:
                "",

            errores: [
                "No se puede validar un archivo cuya fuente es desconocida."
            ]
        };
    }

    // =======================================================
    // IDENTIFICADOR PRINCIPAL
    // =======================================================

    const configuracion =
        FUENTES[fuente];

    const campoIdentificador =
        configuracion.camposClave.join(" / ");

    const nombreIdentificador =
        configuracion.nombreClave;

    const ids =
        new Map<
            string,
            number
        >();


    let registrosSinId =
        0;

    // =======================================================
    // RECORRER REGISTROS
    // =======================================================

    for (
        const registro
        of registros
        ) {

        const identificador =
            obtenerClaveRegistro(
                registro,
                configuracion.camposClave
            );

        if (!identificador) {

            registrosSinId++;

            continue;
        }

        ids.set(
            identificador,
            (
                ids.get(
                    identificador
                ) ?? 0
            ) + 1
        );
    }

    // =======================================================
    // DETECTAR DUPLICADOS
    // =======================================================

    const idsDuplicados =
        Array.from(
            ids.entries()
        )
            .filter(
                ([, cantidad]) =>
                    cantidad > 1
            )
            .map(
                ([id]) =>
                    id
            );

    // =======================================================
    // ERRORES
    // =======================================================

    if (
        registrosSinId > 0
    ) {
        errores.push(
            `${registrosSinId} registro(s) no tienen ${nombreIdentificador}.`
        );
    }

    if (
        idsDuplicados.length > 0
    ) {

        errores.push(
            `Se encontraron ${idsDuplicados.length} ${nombreIdentificador} duplicados.`
        );
    }

    // =======================================================
    // RESULTADO
    // =======================================================

    const registrosValidos =
        registros.length -
        registrosSinId;
    return {

        valido:
            errores.length === 0,
        totalRegistros:
        registros.length,
        registrosValidos,
        registrosSinId,
        idsDuplicados,
        campoIdentificador,
        errores
    };
}