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
    COLLECTION_CAMBIOS,
    COLLECTION_CARGAS,
    COLLECTION_CONFIGURACION,
    COLLECTION_REGISTROS,
    TAMANO_BATCH,
    construirRegistroFuente,
    datosDocumento,
    leerRegistroFuente,
    obtenerIdConfiguracion
} from "./registrosFuente";

import {
    camposCambiados,
    usuarioActual,
    valorComparable
} from "./auditoriaService";

import type {
    CambioFechaFin,
    CampoCambiado,
    TipoCambio
} from "./auditoriaService";

import type {
    RegistroFuente
} from "./registrosFuente";


// =========================================================
// TIPOS
// =========================================================

export type CambioCampo =
    CampoCambiado;


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

    /*
     * Estaban inactivos y vuelven a aparecer en el Excel.
     */
    reactivados:
        RegistroModificado[];

    sinCambios: number;

    inactivos:
        RegistroComparacion[];

    resumen: {
        nuevos: number;
        modificados: number;
        reactivados: number;
        sinCambios: number;
        inactivos: number;
    };
}


// =========================================================
// HELPERS
// =========================================================

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

/*
 * Un registro que hay que escribir y por qué.
 */
interface Escritura {
    registro: RegistroFuente;
    tipo: Exclude<TipoCambio, "INACTIVADO">;
    campos: CampoCambiado[];
}


interface ComparacionInterna {
    resultado: ResultadoComparacionImportacion;
    escrituras: Escritura[];
    inactivados: RegistroFuente[];
}


function compararRegistros(
    registros: Record<string, unknown>[],
    fuente: FuenteConocida,
    guardados: Map<string, RegistroFuente>
): ComparacionInterna {

    const nuevos: RegistroComparacion[] = [];
    const modificados: RegistroModificado[] = [];
    const reactivados: RegistroModificado[] = [];
    const escrituras: Escritura[] = [];
    const presentes = new Set<string>();

    let sinCambios = 0;


    for (const registroOriginal of registros) {

        const registro =
            construirRegistroFuente(
                registroOriginal,
                fuente
            );

        presentes.add(registro.idDocumento);

        const anterior =
            guardados.get(registro.idDocumento);


        if (!anterior) {
            nuevos.push(resumenRegistro(registro));
            escrituras.push({ registro, tipo: "NUEVO", campos: [] });
            continue;
        }


        const campos =
            camposCambiados(anterior, registro, fuente);


        /*
         * Un registro inactivo que vuelve a aparecer se
         * reactiva aunque su contenido no haya cambiado.
         */
        if (!anterior.activo) {
            reactivados.push({ ...resumenRegistro(registro), cambios: campos });
            escrituras.push({ registro, tipo: "REACTIVADO", campos });
            continue;
        }


        if (campos.length === 0) {
            sinCambios += 1;
            continue;
        }


        modificados.push({ ...resumenRegistro(registro), cambios: campos });
        escrituras.push({ registro, tipo: "MODIFICADO", campos });
    }


    const inactivados =
        Array.from(guardados.values()).filter(
            registro =>
                registro.activo &&
                !presentes.has(registro.idDocumento)
        );


    return {
        escrituras,
        inactivados,

        resultado: {
            fuente,
            totalArchivo: registros.length,
            nuevos,
            modificados,
            reactivados,
            sinCambios,
            inactivos: inactivados.map(resumenRegistro),

            resumen: {
                nuevos: nuevos.length,
                modificados: modificados.length,
                reactivados: reactivados.length,
                sinCambios,
                inactivos: inactivados.length
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

/*
 * Cada registro se escribe junto con su documento de
 * auditoría en el mismo lote: o quedan los dos o ninguno.
 * Por eso cada lote lleva la mitad de elementos.
 */
async function escribirEnLotes<T>(
    elementos: T[],
    escribir: (
        batch: ReturnType<typeof writeBatch>,
        elemento: T
    ) => void
) {

    const porLote =
        Math.floor(TAMANO_BATCH / 2);

    for (
        let inicio = 0;
        inicio < elementos.length;
        inicio += porLote
    ) {

        const batch =
            writeBatch(db);

        for (const elemento of elementos.slice(inicio, inicio + porLote)) {
            escribir(batch, elemento);
        }

        await batch.commit();
    }
}


function documentoCambio(
    idCarga: string,
    registro: RegistroFuente,
    tipo: TipoCambio,
    campos: CampoCambiado[],
    usuario: ReturnType<typeof usuarioActual>
) {
    return {
        ref: doc(
            db,
            COLLECTION_CAMBIOS,
            `${idCarga}__${registro.idDocumento}`
        ),

        datos: {
            id_carga: idCarga,
            fuente: registro.fuente,
            codigo_fuente: registro.codigoFuente,
            id_documento: registro.idDocumento,
            clave: registro.clave,
            id_mantenimiento: registro.idMantenimiento,
            id_tramite: registro.idTramite,
            nombre: registro.nombre,
            tipo,
            campos,
            usuario,
            fecha: serverTimestamp()
        }
    };
}


/*
 * Cambios de la fecha final de desarrollo (DT) en esta
 * carga, para la alerta "fecha modificada recientemente".
 */
function cambiosFechaFin(
    escrituras: Escritura[]
): CambioFechaFin[] {
    const resultado: CambioFechaFin[] = [];

    for (const escritura of escrituras) {
        if (escritura.registro.codigoFuente !== "DT") {
            continue;
        }

        const campo =
            escritura.campos.find(item => item.campo === "fin_desarrollo");

        if (campo) {
            resultado.push({
                idDocumento: escritura.registro.idDocumento,
                idMantenimiento: escritura.registro.idMantenimiento ?? "",
                anterior: campo.anterior as string | null,
                nuevo: valorComparable(campo.nuevo) as string | null
            });
        }
    }

    return resultado;
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
        escrituras,
        inactivados
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

    const usuario =
        usuarioActual();

    const cargaRef =
        doc(db, COLLECTION_CARGAS, idCarga);


    /*
     * La carga se registra antes de escribir; si algo
     * falla a mitad queda como EN_PROCESO y se sabe qué
     * registros alcanzó a tocar.
     */
    await setDoc(
        cargaRef,
        {
            id_carga: idCarga,
            tipo: "ACTUALIZACION",
            fuente,
            archivo: archivoNombre,
            hoja,
            fila_cabecera: filaCabecera,
            registros_total: comparacion.totalArchivo,
            nuevos: comparacion.resumen.nuevos,
            modificados: comparacion.resumen.modificados,
            reactivados: comparacion.resumen.reactivados,
            sin_cambios: comparacion.resumen.sinCambios,
            inactivos: comparacion.resumen.inactivos,
            fechas_fin_modificadas: cambiosFechaFin(escrituras),
            usuario,
            estado: "EN_PROCESO",
            fecha_carga: serverTimestamp()
        }
    );


    /*
     * Se reemplaza el documento completo (sin merge)
     * para que no queden columnas que ya no vienen
     * en el Excel.
     */
    await escribirEnLotes(
        escrituras,
        (batch, { registro, tipo, campos }) => {
            batch.set(
                doc(db, COLLECTION_REGISTROS, registro.idDocumento),
                {
                    ...datosDocumento(registro),
                    ultima_carga: idCarga,
                    fecha_actualizacion: serverTimestamp()
                }
            );

            const cambio =
                documentoCambio(idCarga, registro, tipo, campos, usuario);

            batch.set(cambio.ref, cambio.datos);
        }
    );


    await escribirEnLotes(
        inactivados,
        (batch, registro) => {
            batch.set(
                doc(db, COLLECTION_REGISTROS, registro.idDocumento),
                {
                    activo: false,
                    ultima_carga: idCarga,
                    fecha_inactivacion: serverTimestamp(),
                    fecha_actualizacion: serverTimestamp()
                },
                { merge: true }
            );

            const cambio =
                documentoCambio(idCarga, registro, "INACTIVADO", [], usuario);

            batch.set(cambio.ref, cambio.datos);
        }
    );


    await setDoc(
        cargaRef,
        {
            estado: "COMPLETADA",
            fecha_fin: serverTimestamp()
        },
        { merge: true }
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
