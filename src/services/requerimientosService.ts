import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

export type FuenteRequerimiento = "DT" | "CQ" | "DT_CQ";

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

function obtenerFuente(enDT: boolean, enCQ: boolean): FuenteRequerimiento {
    if (enDT && enCQ) return "DT_CQ";
    if (enDT) return "DT";
    return "CQ";
}

export async function obtenerRequerimientos(): Promise<RequerimientoTabla[]> {
    const referencia = collection(db, "requerimientos_v2");
    const snapshot = await getDocs(referencia);

    const requerimientos: RequerimientoTabla[] = [];

    snapshot.forEach(documento => {
        const data = documento.data();

        const demandaTactica =
            data.demanda_tactica && typeof data.demanda_tactica === "object"
                ? data.demanda_tactica as Record<string, unknown>
                : null;

        const clearQuest =
            data.clearquest && typeof data.clearquest === "object"
                ? data.clearquest as Record<string, unknown>
                : null;

        const enDemandaTactica =
            data.en_demanda_tactica === true ||
            demandaTactica !== null;

        const enClearQuest =
            data.en_clearquest === true ||
            clearQuest !== null;

        requerimientos.push({
            idDocumento: documento.id,
            idDemanda: texto(
                data.id_demanda ??
                demandaTactica?.id_demanda
            ),
            idMantenimiento: texto(
                data.id_mantenimiento ??
                demandaTactica?.id_mantenimiento ??
                clearQuest?.id_mantenimiento
            ),
            nombre: texto(
                data.nombre_requerimiento ??
                demandaTactica?.nombre_requerimiento ??
                clearQuest?.descripcion_cq
            ),
            estado: texto(
                demandaTactica?.estado_ti ??
                clearQuest?.estado_cq
            ),
            fuente: obtenerFuente(
                enDemandaTactica,
                enClearQuest
            ),
            responsable: texto(
                demandaTactica?.responsable_dt ??
                clearQuest?.analista_cq
            ),
            recurso: texto(
                demandaTactica?.recurso
            ),
            gerencia: texto(
                demandaTactica?.gerencia
            ),
            aplicacion: texto(
                clearQuest?.aplicacion_cq
            ),
            areaSolicitante: texto(
                clearQuest?.area_solicitante_cq
            ),
            enDemandaTactica,
            enClearQuest,
            demandaTactica,
            clearQuest
        });
    });

    requerimientos.sort((a, b) => {
        const idA =
            a.idMantenimiento ||
            a.idDemanda ||
            a.idDocumento;

        const idB =
            b.idMantenimiento ||
            b.idDemanda ||
            b.idDocumento;

        return idB.localeCompare(idA, "es", {
            numeric: true
        });
    });

    return requerimientos;
}
