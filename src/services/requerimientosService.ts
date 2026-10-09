import {
    collection,
    getDocs
} from "firebase/firestore";

import {
    db
} from "../firebase/firebase";

export type FuenteRequerimiento =
    | "DT"
    | "CQ"
    | "DT_CQ";

export interface RequerimientoTabla {
    idDocumento: string;
    idDemanda: string;
    idMantenimiento: string;
    nombre: string;
    estado: string;
    fuente: FuenteRequerimiento;
    responsable: string;
    recurso: string;
    gerencia: string;
    aplicacion: string;
    areaSolicitante: string;
    enDemandaTactica: boolean;
    enClearQuest: boolean;
    demandaTactica: Record<string, unknown> | null;
    clearQuest: Record<string, unknown> | null;
}

function texto(valor: unknown): string {
    if (valor === null || valor === undefined) return "";
    return String(valor).trim();
}

function comoObjeto(valor: unknown): Record<string, unknown> | null {
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
        return valor as Record<string, unknown>;
    }
    return null;
}

function obtenerFuente(enDT: boolean, enCQ: boolean): FuenteRequerimiento {
    if (enDT && enCQ) return "DT_CQ";
    if (enDT) return "DT";
    return "CQ";
}

export async function obtenerRequerimientos(): Promise<RequerimientoTabla[]> {
    console.log("📥 Consultando colección:", "requerimientos_v2");

    const referencia = collection(
        db,
        "requerimientos_v2"
    );

    const snapshot = await getDocs(
        referencia
    );

    console.log(
        "📦 Documentos encontrados:",
        snapshot.size
    );

    if (snapshot.empty) {
        console.warn(
            "⚠ Firestore devolvió 0 documentos para requerimientos_v2."
        );
        return [];
    }

    const requerimientos: RequerimientoTabla[] = [];

    snapshot.forEach(documento => {
        const data = documento.data();

        const demandaTactica =
            comoObjeto(
                data.demanda_tactica
            );

        const clearQuest =
            comoObjeto(
                data.clearquest
            );

        const enDemandaTactica =
            data.en_demanda_tactica === true ||
            data.activo_demanda_tactica === true ||
            demandaTactica !== null;

        const enClearQuest =
            data.en_clearquest === true ||
            data.activo_clearquest === true ||
            clearQuest !== null;

        const idDemanda =
            texto(
                data.id_demanda ??
                demandaTactica?.id_demanda
            );

        const idMantenimiento =
            texto(
                data.id_mantenimiento ??
                demandaTactica?.id_mantenimiento ??
                clearQuest?.id_mantenimiento ??
                documento.id
            );

        const nombre =
            texto(
                data.nombre_requerimiento ??
                demandaTactica?.nombre_requerimiento ??
                demandaTactica?.descripcion ??
                clearQuest?.descripcion_cq ??
                clearQuest?.descripcion ??
                ""
            );

        const estado =
            texto(
                demandaTactica?.estado_ti ??
                clearQuest?.estado_cq ??
                ""
            );

        const responsable =
            texto(
                demandaTactica?.responsable_dt ??
                demandaTactica?.responsable_atencion ??
                demandaTactica?.responsable ??
                clearQuest?.analista_cq ??
                clearQuest?.analista ??
                ""
            );

        const recurso =
            texto(
                demandaTactica?.recurso ??
                ""
            );

        const gerencia =
            texto(
                demandaTactica?.gerencia ??
                ""
            );

        const aplicacion =
            texto(
                clearQuest?.aplicacion_cq ??
                clearQuest?.aplic ??
                ""
            );

        const areaSolicitante =
            texto(
                clearQuest?.area_solicitante_cq ??
                clearQuest?.area_solicitante ??
                ""
            );

        requerimientos.push({
            idDocumento: documento.id,
            idDemanda,
            idMantenimiento,
            nombre,
            estado,
            fuente: obtenerFuente(
                enDemandaTactica,
                enClearQuest
            ),
            responsable,
            recurso,
            gerencia,
            aplicacion,
            areaSolicitante,
            enDemandaTactica,
            enClearQuest,
            demandaTactica,
            clearQuest
        });
    });

    console.log(
        "✅ Requerimientos transformados:",
        requerimientos.length
    );

    console.log(
        "🔎 Primer requerimiento:",
        requerimientos[0]
    );

    requerimientos.sort((a, b) => {
        const idA =
            a.idMantenimiento ||
            a.idDemanda ||
            a.idDocumento;

        const idB =
            b.idMantenimiento ||
            b.idDemanda ||
            b.idDocumento;

        return idB.localeCompare(
            idA,
            "es",
            {
                numeric: true
            }
        );
    });

    return requerimientos;
}
