import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
    COLLECTION_REGISTROS,
    leerRegistroFuente
} from "./registrosFuente";
import type { RegistroFuente } from "./registrosFuente";
import { consolidarRequerimientos } from "./consolidacionService";
import type { Requerimiento } from "./consolidacionService";

export type { Requerimiento } from "./consolidacionService";

export async function obtenerRequerimientos(): Promise<Requerimiento[]> {
    const snapshot = await getDocs(
        collection(db, COLLECTION_REGISTROS)
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
