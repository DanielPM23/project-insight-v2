import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
    COLLECTION_REGISTROS,
    leerRegistroFuente
} from "./registrosFuente";
import type { RegistroFuente } from "./registrosFuente";
import { consolidarRequerimientos } from "./consolidacionService";
import type { Requerimiento } from "./consolidacionService";

export type { Requerimiento } from "./consolidacionService";

/*
 * Solo se leen los registros activos: los inactivos se
 * acumulan carga tras carga y la consolidación los
 * descartaba igual. Todos los documentos guardan "activo"
 * (true al guardarse, false al inactivarse), así que el
 * filtro no deja fuera a ninguno vigente. La comparación de
 * Importaciones sigue leyendo también los inactivos para
 * poder reactivarlos.
 */
export async function obtenerRequerimientos(): Promise<Requerimiento[]> {
    const snapshot = await getDocs(
        query(
            collection(db, COLLECTION_REGISTROS),
            where("activo", "==", true)
        )
    );

    const registros: RegistroFuente[] = [];

    snapshot.forEach(documento => {
        const registro = leerRegistroFuente(
            documento.id,
            documento.data()
        );

        if (registro) {
            registros.push(registro);
        }
    });

    return consolidarRequerimientos(registros);
}
