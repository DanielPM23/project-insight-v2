import * as XLSX from "xlsx";

import {
    FUENTES
} from "../config/sourceSchemas";

import {
    detectarFuente
} from "./sourceDetectorService";

import type {
    FuenteDatos,
    ConfiguracionFuente
} from "../config/sourceSchemas";

import type {
    AnalisisExcel,
    CampoDetectado
} from "../models/ExcelAnalysis";


// =========================================================
// TIPOS INTERNOS
// =========================================================

interface CandidatoCabecera {
    hoja: string;

    filaIndice: number;

    filas: unknown[][];

    fuente: FuenteDatos;

    nombreFuente: string;

    puntuacion: number;

    camposReconocidos: number;
}


// =========================================================
// NORMALIZACIÓN DE TEXTO
// =========================================================

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


// =========================================================
// CREAR MAPA DE ALIASES PARA UNA FUENTE
// =========================================================

function crearMapaAliasesFuente(
    configuracion: ConfiguracionFuente
): Map<string, string> {

    const mapa =
        new Map<string, string>();


    for (
        const [
            campoCanonico,
            campoConfig
        ]
        of Object.entries(
        configuracion.campos
    )
        ) {

        for (
            const alias
            of campoConfig.aliases
            ) {

            mapa.set(
                normalizarTexto(alias),
                campoCanonico
            );
        }
    }


    return mapa;
}


// =========================================================
// BUSCAR MEJOR CABECERA DEL ARCHIVO
// =========================================================

function buscarMejorCabecera(
    workbook: XLSX.WorkBook
): CandidatoCabecera | null {

    let mejorCandidato:
        CandidatoCabecera | null =
        null;


    for (
        const nombreHoja
        of workbook.SheetNames
        ) {

        const sheet =
            workbook.Sheets[
                nombreHoja
                ];


        if (!sheet) {
            continue;
        }


        const filas =
            XLSX.utils.sheet_to_json<
                unknown[]
            >(
                sheet,
                {
                    header: 1,
                    defval: null,
                    raw: true
                }
            );


        /*
         * Buscamos la cabecera dentro de
         * las primeras 50 filas.
         *
         * No dependemos de:
         * - nombre de hoja
         * - fila fija
         * - versión específica del Excel
         */
        const limite =
            Math.min(
                filas.length,
                50
            );


        for (
            let i = 0;
            i < limite;
            i++
        ) {

            const fila =
                filas[i];


            if (!fila) {
                continue;
            }


            const deteccion =
                detectarFuente(
                    fila
                );


            if (
                deteccion.fuente ===
                "DESCONOCIDA"
            ) {
                continue;
            }


            const candidato:
                CandidatoCabecera = {

                hoja:
                nombreHoja,

                filaIndice:
                i,

                filas,

                fuente:
                deteccion.fuente,

                nombreFuente:
                deteccion.nombre,

                puntuacion:
                deteccion.puntuacion,

                camposReconocidos:
                deteccion.camposReconocidos

            };


            /*
             * Primero elegimos por puntuación.
             *
             * Si empatan, gana la fila que
             * reconoció mayor cantidad de campos.
             */
            const esMejor =
                !mejorCandidato ||

                candidato.puntuacion >
                mejorCandidato.puntuacion ||

                (
                    candidato.puntuacion ===
                    mejorCandidato.puntuacion &&

                    candidato.camposReconocidos >
                    mejorCandidato.camposReconocidos
                );


            if (esMejor) {

                mejorCandidato =
                    candidato;
            }
        }
    }


    return mejorCandidato;
}


// =========================================================
// OBTENER CONFIGURACIÓN DE LA FUENTE
// =========================================================

function obtenerConfiguracionFuente(
    fuente: FuenteDatos
): ConfiguracionFuente {

    if (
        fuente === "DESCONOCIDA"
    ) {

        throw new Error(
            "No existe configuración para una fuente desconocida."
        );
    }


    return FUENTES[
        fuente
        ];
}


// =========================================================
// CONVERTIR CABECERA A TEXTO
// =========================================================

function obtenerCabeceras(
    fila: unknown[]
): string[] {

    return fila.map(
        valor => {

            if (
                valor === null ||
                valor === undefined
            ) {
                return "";
            }


            return String(valor)
                .trim();
        }
    );
}


// =========================================================
// DETECTAR CAMPOS DE LA FUENTE
// =========================================================

function detectarCampos(
    cabeceras: string[],
    configuracionFuente: ConfiguracionFuente
): CampoDetectado[] {

    const mapaAliases =
        crearMapaAliasesFuente(
            configuracionFuente
        );


    const camposDetectados:
        CampoDetectado[] = [];


    /*
     * Evitamos mapear dos columnas Excel
     * distintas al mismo campo canónico.
     */
    const canonicosUtilizados =
        new Set<string>();


    cabeceras.forEach(
        (
            columnaExcel,
            indiceColumna
        ) => {

            const columnaNormalizada =
                normalizarTexto(
                    columnaExcel
                );


            if (!columnaNormalizada) {
                return;
            }


            const campoCanonico =
                mapaAliases.get(
                    columnaNormalizada
                );


            if (!campoCanonico) {
                return;
            }


            if (
                canonicosUtilizados.has(
                    campoCanonico
                )
            ) {
                return;
            }


            const configuracionCampo =
                configuracionFuente.campos[
                    campoCanonico
                    ];


            if (!configuracionCampo) {
                return;
            }


            camposDetectados.push(
                {
                    campoCanonico,

                    columnaExcel,

                    indiceColumna,

                    obligatorio:
                    configuracionCampo
                        .obligatorio
                }
            );


            canonicosUtilizados.add(
                campoCanonico
            );
        }
    );


    return camposDetectados;
}

// =========================================================
// CAMPOS OBLIGATORIOS FALTANTES
// =========================================================

function obtenerCamposObligatoriosFaltantes(
    camposDetectados: CampoDetectado[],
    configuracionFuente: ConfiguracionFuente
): string[] {

    const detectados =
        new Set(
            camposDetectados.map(
                campo =>
                    campo.campoCanonico
            )
        );

    const faltantes:
        string[] = [];

    for (
        const [
            campoCanonico,
            configuracionCampo
        ]
        of Object.entries(
        configuracionFuente.campos
    )
        ) {

        if (
            configuracionCampo.obligatorio &&
            !detectados.has(
                campoCanonico
            )
        ) {

            faltantes.push(
                campoCanonico
            );
        }
    }

    return faltantes;
}

// =========================================================
// COLUMNAS NO RECONOCIDAS
// =========================================================

function obtenerColumnasNoReconocidas(
    cabeceras: string[],
    camposDetectados: CampoDetectado[]
): string[] {

    const indicesReconocidos =
        new Set(
            camposDetectados.map(
                campo =>
                    campo.indiceColumna
            )
        );

    return cabeceras.filter(
        (
            columna,
            indice
        ) => {

            if (!columna) {
                return false;
            }


            return !indicesReconocidos.has(
                indice
            );
        }
    );
}
// =========================================================
// CONVERTIR FILAS A MODELO CANÓNICO
// =========================================================

function construirRegistros(
    filas: unknown[][],
    filaCabeceraIndice: number,
    camposDetectados: CampoDetectado[]
): Record<string, unknown>[] {

    const registros:
        Record<string, unknown>[] =
        [];


    const filasDatos =
        filas.slice(
            filaCabeceraIndice + 1
        );

    for (
        const fila
        of filasDatos
        ) {

        if (!fila) {
            continue;
        }

        const registro:
            Record<string, unknown> = {};


        let tieneDatosReconocidos =
            false;

        for (
            const campo
            of camposDetectados
            ) {

            const valor =
                fila[
                    campo.indiceColumna
                    ];

            const tieneValor =
                valor !== null &&
                valor !== undefined &&
                String(valor).trim() !== "";

            if (tieneValor) {

                tieneDatosReconocidos =
                    true;
            }

            registro[
                campo.campoCanonico
                ] =
                valor ?? null;
        }

        /*
         * Ignoramos filas completamente vacías.
         *
         * Si falta algún ID obligatorio,
         * NO descartamos la fila aquí.
         *
         * El servicio de validación será el
         * encargado de detectarlo.
         */
        if (
            tieneDatosReconocidos
        ) {

            registros.push(
                registro
            );
        }
    }


    return registros;
}

// =========================================================
// ANALIZAR ARCHIVO
// =========================================================

export async function analizarExcel(
    archivo: File
): Promise<AnalisisExcel> {

    // =======================================================
    // LEER ARCHIVO
    // =======================================================

    const buffer =
        await archivo.arrayBuffer();

    const workbook =
        XLSX.read(
            buffer,
            {
                type: "array",

                cellDates: true
            }
        );

    if (
        workbook.SheetNames.length === 0
    ) {

        throw new Error(
            "El archivo no contiene hojas."
        );
    }

    // =======================================================
    // DETECTAR TABLA Y FUENTE
    // =======================================================

    const candidato =
        buscarMejorCabecera(
            workbook
        );

    if (!candidato) {

        throw new Error(
            "No se pudo detectar una tabla compatible con Project Insight."
        );
    }

    if (
        candidato.fuente ===
        "DESCONOCIDA"
    ) {

        throw new Error(
            "Project Insight no pudo identificar la fuente del archivo."
        );
    }
    // =======================================================
    // OBTENER ESQUEMA DE LA FUENTE
    // =======================================================

    const configuracionFuente =
        obtenerConfiguracionFuente(
            candidato.fuente
        );

    // =======================================================
    // CABECERA
    // =======================================================
    const filaCabecera =
        candidato.filas[
            candidato.filaIndice
            ];

    if (!filaCabecera) {

        throw new Error(
            "No se pudo leer la fila de cabecera."
        );
    }

    const cabeceras =
        obtenerCabeceras(
            filaCabecera
        );

    // =======================================================
    // MAPEAR CAMPOS
    // =======================================================
    const camposDetectados =
        detectarCampos(
            cabeceras,
            configuracionFuente
        );
    if (
        camposDetectados.length === 0
    ) {

        throw new Error(
            "No se encontraron columnas compatibles con la fuente detectada."
        );
    }
    // =======================================================
    // CAMPOS OBLIGATORIOS
    // =======================================================

    const camposObligatoriosFaltantes =
        obtenerCamposObligatoriosFaltantes(
            camposDetectados,
            configuracionFuente
        );
    // =======================================================
    // COLUMNAS NO RECONOCIDAS
    // =======================================================
    const columnasNoReconocidas =
        obtenerColumnasNoReconocidas(
            cabeceras,
            camposDetectados
        );

    // =======================================================
    // REGISTROS
    // =======================================================
    const registros =
        construirRegistros(
            candidato.filas,
            candidato.filaIndice,
            camposDetectados
        );
    if (
        registros.length === 0
    ) {
        throw new Error(
            "La tabla fue detectada, pero no contiene registros."
        );
    }
    // =======================================================
    // RESULTADO
    // =======================================================
    return {
        archivo:
        archivo.name,


        // -----------------------------------------------------
        // INFORMACIÓN DE FUENTE
        // -----------------------------------------------------

        fuente:
        candidato.fuente,

        nombreFuente:
        candidato.nombreFuente,

        confianzaFuente:
        candidato.puntuacion,


        // -----------------------------------------------------
        // INFORMACIÓN DE TABLA
        // -----------------------------------------------------

        hoja:
        candidato.hoja,

        /*
         * Excel comienza las filas en 1,
         * mientras los arrays comienzan en 0.
         */
        filaCabecera:
            candidato.filaIndice + 1,
        totalRegistros:
        registros.length,
        totalColumnas:
        cabeceras.filter(
            columna =>
                columna !== ""
        ).length,

        // -----------------------------------------------------
        // MAPEO
        // -----------------------------------------------------
        camposDetectados,
        camposObligatoriosFaltantes,
        columnasNoReconocidas,
        registros

    };
}