import * as XLSX from "xlsx";

import {
    FUENTES,
    esFuenteConocida
} from "../config/sourceSchemas";

import {
    parsearFecha
} from "../utils/fechas";

import {
    detectarFuente
} from "./sourceDetectorService";

import type {
    FuenteDatos,
    ConfiguracionFuente
} from "../config/sourceSchemas";

import {
    CAMPO_EXTRA
} from "../models/ExcelAnalysis";

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

    hojaPreferida: boolean;
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
// HOJA PREFERIDA DE UNA FUENTE
// =========================================================

function esHojaPreferida(
    nombreHoja: string,
    fuente: FuenteDatos
): boolean {

    if (!esFuenteConocida(fuente)) {
        return false;
    }


    const hoja =
        normalizarTexto(
            nombreHoja
        );


    return FUENTES[fuente]
        .hojasPreferidas
        .some(
            preferida =>
                normalizarTexto(preferida) ===
                hoja
        );
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
                deteccion.camposReconocidos,

                hojaPreferida:
                    esHojaPreferida(
                        nombreHoja,
                        deteccion.fuente
                    )

            };


            /*
             * Primero gana la hoja preferida de la fuente
             * (un libro puede repetir las mismas cabeceras
             * en varias hojas), luego la puntuación.
             *
             * Si empatan, gana la fila que
             * reconoció mayor cantidad de campos.
             */
            if (
                mejorCandidato &&
                mejorCandidato.hojaPreferida !==
                candidato.hojaPreferida
            ) {
                if (candidato.hojaPreferida) {
                    mejorCandidato =
                        candidato;
                }

                continue;
            }

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
    cabeceras: string[],
    camposDetectados: CampoDetectado[],
    configuracionFuente: ConfiguracionFuente
): Record<string, unknown>[] {

    const registros:
        Record<string, unknown>[] =
        [];


    const indicesReconocidos =
        new Set(
            camposDetectados.map(
                campo =>
                    campo.indiceColumna
            )
        );


    const camposIdentificacion =
        new Set([
            ...configuracionFuente.camposClave,
            configuracionFuente.campoMantenimiento,
            configuracionFuente.campoTramite ?? "",
            configuracionFuente.campoNombre
        ]);


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

            let valor =
                fila[
                    campo.indiceColumna
                    ];


            const tieneValor =
                valor !== null &&
                valor !== undefined &&
                String(valor).trim() !== "";


            if (
                tieneValor &&
                camposIdentificacion.has(
                    campo.campoCanonico
                )
            ) {
                tieneDatosReconocidos =
                    true;
            }


            if (
                configuracionFuente.campos[
                    campo.campoCanonico
                    ]?.tipo === "fecha"
            ) {
                valor =
                    parsearFecha(
                        valor
                    );
            }


            registro[
                campo.campoCanonico
                ] =
                valor ?? null;
        }


        /*
         * Ignoramos filas sin clave, sin IDs y sin nombre:
         * son filas vacías o de plantilla (fórmulas que
         * rellenan "Por definir", "Sin esfuerzo"...).
         *
         * Si falta algún ID obligatorio,
         * NO descartamos la fila aquí.
         *
         * El servicio de validación será el
         * encargado de detectarlo.
         */
        if (
            !tieneDatosReconocidos
        ) {
            continue;
        }


        /*
         * Las columnas que no están en el esquema
         * también se guardan, para poder mostrar
         * todos los campos del Excel en el detalle.
         */
        const extra:
            Record<string, unknown> = {};


        cabeceras.forEach(
            (
                cabecera,
                indice
            ) => {

                if (
                    !cabecera ||
                    indicesReconocidos.has(
                        indice
                    ) ||
                    cabecera in extra
                ) {
                    return;
                }


                const valor =
                    fila[indice];


                if (
                    valor === null ||
                    valor === undefined ||
                    String(valor).trim() === ""
                ) {
                    return;
                }


                extra[cabecera] =
                    valor;
            }
        );


        registro[CAMPO_EXTRA] =
            extra;


        registros.push(
            registro
        );
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
            cabeceras,
            camposDetectados,
            configuracionFuente
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