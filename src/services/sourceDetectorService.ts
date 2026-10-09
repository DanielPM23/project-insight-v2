import {
    FUENTES
} from "../config/sourceSchemas";

import type {
    FuenteDatos
} from "../config/sourceSchemas";


function normalizarTexto(
    valor: unknown
): string {

    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }


    return String(valor)
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .trim()
        .toLowerCase()
        .replace(
            /[\n\r\t]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        );
}


export interface ResultadoDeteccionFuente {

    fuente: FuenteDatos;

    nombre: string;

    puntuacion: number;

    camposReconocidos: number;

}


export function detectarFuente(
    cabeceras: unknown[]
): ResultadoDeteccionFuente {

    const cabecerasNormalizadas =
        new Set(
            cabeceras.map(
                normalizarTexto
            )
        );


    let mejorFuente:
        FuenteDatos =
        "DESCONOCIDA";

    let mejorNombre =
        "Desconocida";

    let mejorPuntuacion =
        0;

    let mejoresCampos =
        0;


    for (
        const [
            codigoFuente,
            configuracion
        ]
        of Object.entries(FUENTES)
        ) {

        let puntuacion =
            0;

        let camposReconocidos =
            0;


        for (
            const campo
            of Object.values(
            configuracion.campos
        )
            ) {

            const encontrado =
                campo.aliases.some(
                    alias =>
                        cabecerasNormalizadas.has(
                            normalizarTexto(
                                alias
                            )
                        )
                );


            if (!encontrado) {
                continue;
            }


            camposReconocidos++;


            /*
             * Los campos obligatorios pesan más
             * para distinguir mejor la fuente.
             */
            puntuacion +=
                campo.obligatorio
                    ? 5
                    : 1;

        }


        if (
            puntuacion >
            mejorPuntuacion
        ) {

            mejorPuntuacion =
                puntuacion;

            mejoresCampos =
                camposReconocidos;

            mejorFuente =
                codigoFuente as FuenteDatos;

            mejorNombre =
                configuracion.nombre;
        }
    }


    /*
     * Si apenas reconoce una columna,
     * evitamos asumir una fuente.
     */
    if (
        mejoresCampos < 2
    ) {

        return {

            fuente:
                "DESCONOCIDA",

            nombre:
                "Desconocida",

            puntuacion:
                0,

            camposReconocidos:
            mejoresCampos

        };
    }


    return {

        fuente:
        mejorFuente,

        nombre:
        mejorNombre,

        puntuacion:
        mejorPuntuacion,

        camposReconocidos:
        mejoresCampos

    };
}