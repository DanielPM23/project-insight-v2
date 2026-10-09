import {
    collection,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    writeBatch
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
    FUENTES,
    esFuenteConocida
} from "../config/sourceSchemas";

import type { FuenteDatos } from "../config/sourceSchemas";

import {
    COLLECTION_CARGAS,
    COLLECTION_CONFIGURACION,
    COLLECTION_REGISTROS,
    TAMANO_BATCH,
    construirRegistroFuente,
    datosDocumento,
    obtenerIdConfiguracion
} from "./registrosFuente";


export async function establecerBaseline(
    registros: Record<string, unknown>[],
    archivoNombre: string,
    hoja: string,
    filaCabecera: number,
    fuente: FuenteDatos
) {

    if (!esFuenteConocida(fuente)) {

        throw new Error(
            "No se puede crear un baseline para una fuente desconocida."
        );
    }


    if (registros.length === 0) {

        throw new Error(
            "No existen registros para guardar."
        );
    }


    const configuracion =
        FUENTES[fuente];


    const configuracionRef =
        doc(
            db,
            COLLECTION_CONFIGURACION,
            obtenerIdConfiguracion(
                fuente
            )
        );


    const configuracionActual =
        await getDoc(
            configuracionRef
        );


    if (
        configuracionActual.exists() &&
        configuracionActual.data()?.inicializado === true
    ) {

        throw new Error(
            `${configuracion.nombre} ya tiene una base inicial registrada.`
        );
    }


    const idCarga =
        `baseline_${configuracion.codigo.toLowerCase()}_${Date.now()}`;


    const registrosFuente =
        registros.map(
            registro =>
                construirRegistroFuente(
                    registro,
                    fuente
                )
        );


    let guardados = 0;


    for (
        let inicio = 0;
        inicio < registrosFuente.length;
        inicio += TAMANO_BATCH
    ) {

        const grupo =
            registrosFuente.slice(
                inicio,
                inicio + TAMANO_BATCH
            );


        const batch =
            writeBatch(db);


        for (const registro of grupo) {

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
