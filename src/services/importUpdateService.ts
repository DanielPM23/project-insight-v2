import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
    writeBatch
} from "firebase/firestore";

import {
    db
} from "../firebase/firebase";

import type {
    FuenteDatos
} from "../config/sourceSchemas";


const COLLECTION_REQUERIMIENTOS =
    "requerimientos_v2";

const COLLECTION_CARGAS =
    "cargas_v2";

const COLLECTION_CONFIGURACION =
    "configuracion_v2";

const TAMANO_BATCH =
    400;


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
    fuente: Exclude<
        FuenteDatos,
        "DESCONOCIDA"
    >;

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


interface RegistroPreparado {
    idDocumento: string;
    registro:
        Record<string, unknown>;
}


interface DocumentoActual {
    idDocumento: string;
    data:
        Record<string, unknown>;
}


// =========================================================
// HELPERS
// =========================================================

function limpiarTextoId(
    valor: unknown
): string {

    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor)
        .trim()
        .toUpperCase();
}


function limpiarIdDocumento(
    valor: string
): string {

    return valor
        .trim()
        .replace(/\//g, "-");
}


function limpiarRegistro(
    registro: Record<string, unknown>
): Record<string, unknown> {

    const limpio:
        Record<string, unknown> = {};

    for (
        const [clave, valor]
        of Object.entries(registro)
        ) {

        limpio[clave] =
            valor === undefined
                ? null
                : valor;
    }

    return limpio;
}


function obtenerIdConfiguracion(
    fuente: FuenteDatos
): string {

    switch (fuente) {

        case "DEMANDA_TACTICA":
            return "baseline_demanda_tactica";

        case "CLEARQUEST":
            return "baseline_clearquest";

        default:
            throw new Error(
                "La fuente no es compatible con actualizaciones."
            );
    }
}


function obtenerIdDocumentoTeorico(
    registro: Record<string, unknown>,
    fuente: FuenteDatos
): string {

    if (
        fuente === "DEMANDA_TACTICA"
    ) {

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


    if (
        fuente === "CLEARQUEST"
    ) {

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
        "No se puede procesar una fuente desconocida."
    );
}


function obtenerBloqueFuente(
    data: Record<string, unknown>,
    fuente: FuenteDatos
): Record<string, unknown> | null {

    const valor =
        fuente === "DEMANDA_TACTICA"
            ? data.demanda_tactica
            : data.clearquest;


    if (
        valor &&
        typeof valor === "object"
    ) {

        return valor as Record<string, unknown>;
    }


    return null;
}


function documentoPerteneceFuente(
    data: Record<string, unknown>,
    fuente: FuenteDatos
): boolean {

    if (
        fuente === "DEMANDA_TACTICA"
    ) {

        return (
            data.en_demanda_tactica === true ||
            obtenerBloqueFuente(
                data,
                fuente
            ) !== null
        );
    }


    if (
        fuente === "CLEARQUEST"
    ) {

        return (
            data.en_clearquest === true ||
            obtenerBloqueFuente(
                data,
                fuente
            ) !== null
        );
    }


    return false;
}


function documentoActivoFuente(
    data: Record<string, unknown>,
    fuente: FuenteDatos
): boolean {

    if (
        !documentoPerteneceFuente(
            data,
            fuente
        )
    ) {
        return false;
    }


    if (
        fuente === "DEMANDA_TACTICA"
    ) {

        return (
            data.activo_demanda_tactica !== false
        );
    }


    return (
        data.activo_clearquest !== false
    );
}


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


function obtenerNombreRegistro(
    registro: Record<string, unknown>,
    fuente: FuenteDatos
): string {

    if (
        fuente === "DEMANDA_TACTICA"
    ) {

        return String(
            registro.nombre_requerimiento ??
            ""
        ).trim();
    }


    return String(
        registro.descripcion_cq ??
        ""
    ).trim();
}


function obtenerIdPrincipal(
    registro: Record<string, unknown>,
    fuente: FuenteDatos
): string {

    if (
        fuente === "DEMANDA_TACTICA"
    ) {

        return (
            limpiarTextoId(
                registro.id_mantenimiento
            ) ||
            limpiarTextoId(
                registro.id_demanda
            )
        );
    }


    return limpiarTextoId(
        registro.id_mantenimiento
    );
}


function resumenDocumentoActual(
    documento:
    DocumentoActual,
    fuente: FuenteDatos
): RegistroComparacion {

    const bloque =
        obtenerBloqueFuente(
            documento.data,
            fuente
        ) ?? {};


    return {
        idDocumento:
        documento.idDocumento,

        idPrincipal:
            obtenerIdPrincipal(
                bloque,
                fuente
            ) ||
            documento.idDocumento,

        nombre:
            obtenerNombreRegistro(
                bloque,
                fuente
            )
    };
}


// =========================================================
// BASELINE
// =========================================================

export async function existeBaselineFuente(
    fuente: FuenteDatos
): Promise<boolean> {

    if (
        fuente === "DESCONOCIDA"
    ) {
        return false;
    }


    const referencia =
        doc(
            db,
            COLLECTION_CONFIGURACION,
            obtenerIdConfiguracion(
                fuente
            )
        );


    const snapshot =
        await getDoc(
            referencia
        );


    return (
        snapshot.exists() &&
        snapshot.data()
            ?.inicializado === true
    );
}


// =========================================================
// RESOLUCIÓN DE IDENTIDAD
// =========================================================

function crearIndices(
    documentos:
    DocumentoActual[]
) {

    const porDocumento =
        new Map<
            string,
            DocumentoActual
        >();

    const porMantenimiento =
        new Map<
            string,
            DocumentoActual
        >();

    const porDemanda =
        new Map<
            string,
            DocumentoActual
        >();


    for (
        const documento
        of documentos
        ) {

        porDocumento.set(
            documento.idDocumento,
            documento
        );


        const data =
            documento.data;


        const idMantenimiento =
            limpiarTextoId(
                data.id_mantenimiento
            ) ||
            limpiarTextoId(
                (data.demanda_tactica as Record<string, unknown> | undefined)?.id_mantenimiento
            ) ||
            limpiarTextoId(
                (data.clearquest as Record<string, unknown> | undefined)?.id_mantenimiento
            );


        const idDemanda =
            limpiarTextoId(
                data.id_demanda
            ) ||
            limpiarTextoId(
                (data.demanda_tactica as Record<string, unknown> | undefined)?.id_demanda
            );


        if (
            idMantenimiento &&
            !porMantenimiento.has(
                idMantenimiento
            )
        ) {

            porMantenimiento.set(
                idMantenimiento,
                documento
            );
        }


        if (
            idDemanda &&
            !porDemanda.has(
                idDemanda
            )
        ) {

            porDemanda.set(
                idDemanda,
                documento
            );
        }
    }


    return {
        porDocumento,
        porMantenimiento,
        porDemanda
    };
}


function resolverDocumentoExistente(
    registro:
    Record<string, unknown>,
    fuente:
    FuenteDatos,
    indices:
    ReturnType<
        typeof crearIndices
    >
): DocumentoActual | null {

    const idTeorico =
        obtenerIdDocumentoTeorico(
            registro,
            fuente
        );


    const porDocumento =
        indices.porDocumento.get(
            idTeorico
        );


    if (porDocumento) {
        return porDocumento;
    }


    const idMantenimiento =
        limpiarTextoId(
            registro.id_mantenimiento
        );


    if (idMantenimiento) {

        const porMantenimiento =
            indices
                .porMantenimiento
                .get(
                    idMantenimiento
                );


        if (porMantenimiento) {
            return porMantenimiento;
        }
    }


    if (
        fuente === "DEMANDA_TACTICA"
    ) {

        const idDemanda =
            limpiarTextoId(
                registro.id_demanda
            );


        if (idDemanda) {

            const porDemanda =
                indices
                    .porDemanda
                    .get(
                        idDemanda
                    );


            if (porDemanda) {
                return porDemanda;
            }
        }
    }


    return null;
}


// =========================================================
// COMPARACIÓN
// =========================================================

export async function compararConUltimaCarga(
    registros:
    Record<string, unknown>[],
    fuente:
    FuenteDatos
): Promise<ResultadoComparacionImportacion> {

    if (
        fuente === "DESCONOCIDA"
    ) {

        throw new Error(
            "No se puede comparar una fuente desconocida."
        );
    }


    const existeBaseline =
        await existeBaselineFuente(
            fuente
        );


    if (!existeBaseline) {

        throw new Error(
            "La fuente todavía no tiene una base inicial."
        );
    }


    const snapshot =
        await getDocs(
            collection(
                db,
                COLLECTION_REQUERIMIENTOS
            )
        );


    const documentos:
        DocumentoActual[] =
        snapshot.docs.map(
            documento => ({
                idDocumento:
                documento.id,

                data:
                    documento.data() as Record<string, unknown>
            })
        );


    const indices =
        crearIndices(
            documentos
        );


    const nuevos:
        RegistroComparacion[] = [];

    const modificados:
        RegistroModificado[] = [];

    let sinCambios =
        0;


    const documentosPresentes =
        new Set<string>();


    for (
        const registroOriginal
        of registros
        ) {

        const registro =
            limpiarRegistro(
                registroOriginal
            );


        const documentoExistente =
            resolverDocumentoExistente(
                registro,
                fuente,
                indices
            );


        if (!documentoExistente) {

            const idDocumento =
                obtenerIdDocumentoTeorico(
                    registro,
                    fuente
                );


            documentosPresentes.add(
                idDocumento
            );


            nuevos.push({
                idDocumento,

                idPrincipal:
                    obtenerIdPrincipal(
                        registro,
                        fuente
                    ),

                nombre:
                    obtenerNombreRegistro(
                        registro,
                        fuente
                    )
            });


            continue;
        }


        documentosPresentes.add(
            documentoExistente
                .idDocumento
        );


        const anterior =
            obtenerBloqueFuente(
                documentoExistente.data,
                fuente
            );


        if (!anterior) {

            nuevos.push({
                idDocumento:
                documentoExistente
                    .idDocumento,

                idPrincipal:
                    obtenerIdPrincipal(
                        registro,
                        fuente
                    ),

                nombre:
                    obtenerNombreRegistro(
                        registro,
                        fuente
                    )
            });


            continue;
        }


        if (
            registrosIguales(
                anterior,
                registro
            )
        ) {

            sinCambios += 1;

            continue;
        }


        modificados.push({
            idDocumento:
            documentoExistente
                .idDocumento,

            idPrincipal:
                obtenerIdPrincipal(
                    registro,
                    fuente
                ),

            nombre:
                obtenerNombreRegistro(
                    registro,
                    fuente
                ),

            cambios:
                obtenerCambios(
                    anterior,
                    registro
                )
        });
    }


    const inactivos:
        RegistroComparacion[] = [];


    for (
        const documento
        of documentos
        ) {

        if (
            !documentoActivoFuente(
                documento.data,
                fuente
            )
        ) {
            continue;
        }


        if (
            documentosPresentes.has(
                documento.idDocumento
            )
        ) {
            continue;
        }


        inactivos.push(
            resumenDocumentoActual(
                documento,
                fuente
            )
        );
    }


    const fuenteTipada =
        fuente as Exclude<
            FuenteDatos,
            "DESCONOCIDA"
        >;


    return {
        fuente:
        fuenteTipada,

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
    };
}


// =========================================================
// CONSTRUCCIÓN DE DATOS DE FIRESTORE
// =========================================================

function datosActualizacionFuente(
    registro:
    Record<string, unknown>,
    fuente:
    Exclude<
        FuenteDatos,
        "DESCONOCIDA"
    >,
    idCarga:
    string
): Record<string, unknown> {

    const registroLimpio =
        limpiarRegistro(
            registro
        );


    if (
        fuente === "DEMANDA_TACTICA"
    ) {

        const datos:
            Record<string, unknown> = {

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


        const idDemanda =
            String(
                registro.id_demanda ??
                ""
            ).trim();


        const idMantenimiento =
            String(
                registro.id_mantenimiento ??
                ""
            ).trim();


        const nombre =
            String(
                registro.nombre_requerimiento ??
                ""
            ).trim();


        if (idDemanda) {
            datos.id_demanda =
                idDemanda;
        }


        if (idMantenimiento) {
            datos.id_mantenimiento =
                idMantenimiento;
        }


        if (nombre) {
            datos.nombre_requerimiento =
                nombre;
        }


        return datos;
    }


    const datos:
        Record<string, unknown> = {

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


    const idMantenimiento =
        String(
            registro.id_mantenimiento ??
            ""
        ).trim();


    if (idMantenimiento) {
        datos.id_mantenimiento =
            idMantenimiento;
    }


    return datos;
}


function datosInactivacionFuente(
    fuente:
    Exclude<
        FuenteDatos,
        "DESCONOCIDA"
    >,
    idCarga:
    string
): Record<string, unknown> {

    if (
        fuente === "DEMANDA_TACTICA"
    ) {

        return {
            activo_demanda_tactica:
                false,

            ultima_carga_demanda_tactica:
            idCarga,

            fecha_inactivacion_demanda_tactica:
                serverTimestamp(),

            fecha_actualizacion_demanda_tactica:
                serverTimestamp(),

            ultima_fuente_importada:
                "DEMANDA_TACTICA",

            fecha_ultima_importacion:
                serverTimestamp()
        };
    }


    return {
        activo_clearquest:
            false,

        ultima_carga_clearquest:
        idCarga,

        fecha_inactivacion_clearquest:
            serverTimestamp(),

        fecha_actualizacion_clearquest:
            serverTimestamp(),

        ultima_fuente_importada:
            "CLEARQUEST",

        fecha_ultima_importacion:
            serverTimestamp()
    };
}


// =========================================================
// APLICAR ACTUALIZACIÓN
// =========================================================

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

    if (
        fuente === "DESCONOCIDA"
    ) {

        throw new Error(
            "No se puede actualizar una fuente desconocida."
        );
    }


    const comparacion =
        await compararConUltimaCarga(
            registros,
            fuente
        );


    const prefijo =
        fuente === "DEMANDA_TACTICA"
            ? "dt"
            : "cq";


    const idCarga =
        `carga_${prefijo}_${Date.now()}`;


    const snapshot =
        await getDocs(
            collection(
                db,
                COLLECTION_REQUERIMIENTOS
            )
        );


    const documentos:
        DocumentoActual[] =
        snapshot.docs.map(
            documento => ({
                idDocumento:
                documento.id,

                data:
                    documento.data() as Record<string, unknown>
            })
        );


    const indices =
        crearIndices(
            documentos
        );


    const idNuevos =
        new Set(
            comparacion.nuevos.map(
                item =>
                    item.idDocumento
            )
        );


    const idModificados =
        new Set(
            comparacion.modificados.map(
                item =>
                    item.idDocumento
            )
        );


    const registrosAEscribir:
        RegistroPreparado[] = [];


    for (
        const registroOriginal
        of registros
        ) {

        const registro =
            limpiarRegistro(
                registroOriginal
            );


        const existente =
            resolverDocumentoExistente(
                registro,
                fuente,
                indices
            );


        const idDocumento =
            existente
                ?.idDocumento ??
            obtenerIdDocumentoTeorico(
                registro,
                fuente
            );


        if (
            !idNuevos.has(
                idDocumento
            ) &&
            !idModificados.has(
                idDocumento
            )
        ) {

            continue;
        }


        registrosAEscribir.push({
            idDocumento,
            registro
        });
    }


    for (
        let inicio = 0;
        inicio < registrosAEscribir.length;
        inicio += TAMANO_BATCH
    ) {

        const lote =
            registrosAEscribir.slice(
                inicio,
                inicio + TAMANO_BATCH
            );


        const batch =
            writeBatch(
                db
            );


        for (
            const item
            of lote
            ) {

            const referencia =
                doc(
                    db,
                    COLLECTION_REQUERIMIENTOS,
                    item.idDocumento
                );


            batch.set(
                referencia,
                {
                    id_registro:
                    item.idDocumento,

                    ...datosActualizacionFuente(
                        item.registro,
                        fuente,
                        idCarga
                    )
                },
                {
                    merge: true
                }
            );
        }


        await batch.commit();
    }


    for (
        let inicio = 0;
        inicio < comparacion.inactivos.length;
        inicio += TAMANO_BATCH
    ) {

        const lote =
            comparacion.inactivos.slice(
                inicio,
                inicio + TAMANO_BATCH
            );


        const batch =
            writeBatch(
                db
            );


        for (
            const item
            of lote
            ) {

            const referencia =
                doc(
                    db,
                    COLLECTION_REQUERIMIENTOS,
                    item.idDocumento
                );


            batch.set(
                referencia,
                datosInactivacionFuente(
                    fuente,
                    idCarga
                ),
                {
                    merge: true
                }
            );
        }


        await batch.commit();
    }


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
