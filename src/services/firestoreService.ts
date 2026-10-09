import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";


export async function probarConexionFirestore() {

    const referencia = doc(
        db,
        "configuracion",
        "conexion"
    );

    await setDoc(
        referencia,
        {
            proyecto: "Project Insight V2",
            estado: "OK",
            version: "2.0",
            fechaConexion: serverTimestamp(),
        },
        {
            merge: true,
        }
    );

    const documento = await getDoc(
        referencia
    );

    if (!documento.exists()) {
        throw new Error(
            "No se pudo encontrar el documento de prueba."
        );
    }

    return documento.data();
}