import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
    writeBatch
} from "firebase/firestore";

import {
    db
} from "../firebase/firebase";

import {
    FUENTES,
    esFuenteConocida
} from "../config/sourceSchemas";

import type {
    FuenteConocida,
    FuenteDatos
} from "../config/sourceSchemas";

import {
    COLLECTION_CARGAS,
    COLLECTION_CONFIGURACION,
    COLLECTION_REGISTROS,
    TAMANO_BATCH,
    construirRegistroFuente,
    contenidoComparable,
    datosDocumento,
    leerRegistroFuente,
    obtenerIdConfiguracion
} from "./registrosFuente";

import type {
    RegistroFuente
} from "./registrosFuente";


// =========================================================
// TIPOS
// =========================================================

export interface CambioCampo {
    campo: string;
    anterior: unknown;
    nuevo: unknown;
}


export interface RegistroComparacion {
    idDocumento: string;
    idPrincipal: string;
    nombre: string;
}


export interface RegistroModificado
    extends RegistroComparacion {

    cambios: CambioCampo[];
}


export interface ResultadoComparacionImportacion {

    fuente: FuenteConocida;

    totalArchivo: number;

    nuevos:
        RegistroComparacion[];

    modificados:
        RegistroModificado[];

    sinCambios: number;

    inactivos:
        RegistroComparacion[];

    resumen: {
        nuevos: number;
        modificados: number;
        sinCambios: number;
        inactivos: number;
    };
}


// =========================================================
// HELPERS
// =========================================================

function valorComparable(
    valor: unknown
): unknown {

    if (
        valor === undefined ||
        valor === null
    ) {
        return null;
    }


    if (
        valor instanceof Date
    ) {

        return valor.toISOString();
    }


    if (
        typeof valor === "object"
    ) {

        const posibleTimestamp =
            valor as {
                toDate?: () => Date;
            };


        if (
            typeof posibleTimestamp.toDate ===
            "function"
        ) {

            return posibleTimestamp
                .toDate()
                .toISOString();
        }


        if (
            Array.isArray(valor)
        ) {

            return valor.map(
                elemento =>
                    valorComparable(
                        elemento
                    )
            );
        }


        const objeto =
            valor as Record<
                string,
                unknown
            >;


        const normalizado:
            Record<string, unknown> = {};


        for (
            const clave
            of Object
            .keys(objeto)
            .sort()
            ) {

            normalizado[clave] =
                valorComparable(
                    objeto[clave]
                );
        }


        return normalizado;
    }


    if (
        typeof valor === "string"
    ) {

        return valor.trim();
    }


    return valor;
}


function registrosIguales(
    anterior: Record<string, unknown>,
    nuevo: Record<string, unknown>
): boolean {

    return (
        JSON.stringify(
            valorComparable(
                anterior
            )
        ) ===
        JSON.stringify(
            valorComparable(
                nuevo
            )
        )
    );
}


function obtenerCambios(
    anterior: Record<string, unknown>,
    nuevo: Record<string, unknown>
): CambioCampo[] {

    const claves =
        new Set([
            ...Object.keys(anterior),
            ...Object.keys(nuevo)
        ]);


    const cambios:
        CambioCampo[] = [];


    for (
        const clave
        of Array.from(claves).sort()
        ) {

        const anteriorComparable =
            valorComparable(
                anterior[clave]
            );


        const nuevoComparable =
            valorComparable(
                nuevo[clave]
            );


        if (
            JSON.stringify(
                anteriorComparable
            ) !==
            JSON.stringify(
                nuevoComparable
            )
        ) {

            cambios.push({
                campo:
                clave,

                anterior:
                anteriorComparable,

                nuevo:
                nuevoComparable
            });
        }
    }


    return cambios;
}


function resumenRegistro(
    registro: RegistroFuente
): RegistroComparacion {

    return {
        idDocumento:
        registro.idDocumento,

        idPrincipal:
            [
                registro.clave,
                registro.idMantenimiento ??
                registro.idTramite
            ]
                .filter(Boolean)
                .join(" · "),

        nombre:
        registro.nombre
    };
}


async function obtenerRegistrosGuardados(
    fuente: FuenteConocida
): Promise<Map<string, RegistroFuente>> {

    const snapshot =
        await getDocs(
            query(
                collection(
                    db,
                    COLLECTION_REGISTROS
                ),
                where(
                    "fuente",
                    "==",
                    fuente
                )
            )
        );


    const registros =
        new Map<string, RegistroFuente>();


    snapshot.forEach(
        documento => {

            const registro =
                leerRegistroFuente(
                    documento.id,
                    documento.data()
                );

            if (registro) {
                registros.set(
                    documento.id,
                    registro
                );
            }
        }
    );


    return registros;
}


// =========================================================
// BASELINE
// =========================================================

export async function existeBaselineFuente(
    fuente: FuenteDatos
): Promise<boolean> {

    if (!esFuenteConocida(fuente)) {
        return false;
    }


    const snapshot =
        await getDoc(
            doc(
                db,
                COLLECTION_CONFIGURACION,
                obtenerIdConfiguracion(
                    fuente
                )
            )
        );


    return (
        snapshot.exists() &&
        snapshot.data()
            ?.inicializado === true
    );
}


// =========================================================
// COMPARACIÓN
// =========================================================

interface ComparacionInterna {
    resultado: ResultadoComparacionImportacion;
    aEscribir: RegistroFuente[];
}


function compararRegistros(
    registros: Record<string, unknown>[],
    fuente: FuenteConocida,
    guardados: Map<string, RegistroFuente>
): ComparacionInterna {

    const nuevos:
        RegistroComparacion[] = [];

    const modificados:
        RegistroModificado[] = [];

    const aEscribir:
        RegistroFuente[] = [];

    let sinCambios =
        0;

    const presentes =
        new Set<string>();


    for (const registroOriginal of registros) {

        const registro =
            construirRegistroFuente(
                registroOriginal,
                fuente
            );


        presentes.add(
            registro.idDocumento
        );


        const anterior =
            guardados.get(
                registro.idDocumento
            );


        /*
         * Un registro que estaba inactivo y vuelve a
         * aparecer en el Excel se trata como nuevo.
         */
        if (
            !anterior ||
            !anterior.activo
        ) {

            nuevos.push(
                resumenRegistro(
                    registro
                )
            );

            aEscribir.push(
                registro
            );

            continue;
        }


        const contenidoAnterior =
            contenidoComparable(
                anterior.datos,
                anterior.extra
            );

        const contenidoNuevo =
            contenidoComparable(
                registro.datos,
                registro.extra
            );


        if (
            registrosIguales(
                contenidoAnterior,
                contenidoNuevo
            )
        ) {
            sinCambios += 1;
            continue;
        }


        modificados.push({
            ...resumenRegistro(
                registro
            ),

            cambios:
                obtenerCambios(
                    contenidoAnterior,
                    contenidoNuevo
                )
        });


        aEscribir.push(
            registro
        );
    }


    const inactivos:
        RegistroComparacion[] = [];


    for (const registro of guardados.values()) {

        if (
            registro.activo &&
            !presentes.has(
                registro.idDocumento
            )
        ) {
            inactivos.push(
                resumenRegistro(
                    registro
                )
            );
        }
    }


    return {
        aEscribir,

        resultado: {
            fuente,

            totalArchivo:
            registros.length,

            nuevos,

            modificados,

            sinCambios,

            inactivos,

            resumen: {
                nuevos:
                nuevos.length,

                modificados:
                modificados.length,

                sinCambios,

                inactivos:
                inactivos.length
            }
        }
    };
}


export async function compararConUltimaCarga(
    registros:
    Record<string, unknown>[],
    fuente:
    FuenteDatos
): Promise<ResultadoComparacionImportacion> {

    if (!esFuenteConocida(fuente)) {

        throw new Error(
            "No se puede comparar una fuente desconocida."
        );
    }


    if (
        !await existeBaselineFuente(
            fuente
        )
    ) {

        throw new Error(
            "La fuente todavía no tiene una base inicial."
        );
    }


    return compararRegistros(
        registros,
        fuente,
        await obtenerRegistrosGuardados(
            fuente
        )
    ).resultado;
}


// =========================================================
// APLICAR ACTUALIZACIÓN
// =========================================================

async function escribirEnLotes<T>(
    elementos: T[],
    escribir: (
        batch: ReturnType<typeof writeBatch>,
        elemento: T
    ) => void
) {

    for (
        let inicio = 0;
        inicio < elementos.length;
        inicio += TAMANO_BATCH
    ) {

        const batch =
            writeBatch(
                db
            );


        for (
            const elemento
            of elementos.slice(
                inicio,
                inicio + TAMANO_BATCH
            )
            ) {
            escribir(
                batch,
                elemento
            );
        }


        await batch.commit();
    }
}


export async function aplicarActualizacionFuente(
    registros:
    Record<string, unknown>[],
    archivoNombre:
    string,
    hoja:
    string,
    filaCabecera:
    number,
    fuente:
    FuenteDatos
) {

    if (!esFuenteConocida(fuente)) {

        throw new Error(
            "No se puede actualizar una fuente desconocida."
        );
    }


    if (
        !await existeBaselineFuente(
            fuente
        )
    ) {

        throw new Error(
            "La fuente todavía no tiene una base inicial."
        );
    }


    const {
        resultado: comparacion,
        aEscribir
    } =
        compararRegistros(
            registros,
            fuente,
            await obtenerRegistrosGuardados(
                fuente
            )
        );


    const idCarga =
        `carga_${FUENTES[fuente].codigo.toLowerCase()}_${Date.now()}`;


    /*
     * Se reemplaza el documento completo (sin merge)
     * para que no queden columnas que ya no vienen
     * en el Excel.
     */
    await escribirEnLotes(
        aEscribir,
        (batch, registro) =>
            batch.set(
                doc(
                    db,
                    COLLECTION_REGISTROS,
                    registro.idDocumento
                ),
                {
                    ...datosDocumento(
                        registro
                    ),

                    ultima_carga:
                    idCarga,

                    fecha_actualizacion:
                        serverTimestamp()
                }
            )
    );


    await escribirEnLotes(
        comparacion.inactivos,
        (batch, item) =>
            batch.set(
                doc(
                    db,
                    COLLECTION_REGISTROS,
                    item.idDocumento
                ),
                {
                    activo:
                        false,

                    ultima_carga:
                    idCarga,

                    fecha_inactivacion:
                        serverTimestamp(),

                    fecha_actualizacion:
                        serverTimestamp()
                },
                {
                    merge: true
                }
            )
    );


    await setDoc(
        doc(
            db,
            COLLECTION_CARGAS,
            idCarga
        ),
        {
            id_carga:
            idCarga,

            tipo:
                "ACTUALIZACION",

            fuente,

            archivo:
            archivoNombre,

            hoja,

            fila_cabecera:
            filaCabecera,

            registros_total:
            comparacion.totalArchivo,

            nuevos:
            comparacion.resumen.nuevos,

            modificados:
            comparacion.resumen.modificados,

            sin_cambios:
            comparacion.resumen.sinCambios,

            inactivos:
            comparacion.resumen.inactivos,

            estado:
                "COMPLETADA",

            fecha_carga:
                serverTimestamp()
        }
    );


    await setDoc(
        doc(
            db,
            COLLECTION_CONFIGURACION,
            obtenerIdConfiguracion(
                fuente
            )
        ),
        {
            ultima_carga:
            idCarga,

            archivo_ultima_carga:
            archivoNombre,

            fecha_ultima_carga:
                serverTimestamp(),

            registros_ultima_carga:
            comparacion.totalArchivo
        },
        {
            merge: true
        }
    );


    return {
        idCarga,
        comparacion
    };
}
