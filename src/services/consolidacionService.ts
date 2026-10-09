import type {
    CodigoFuente
} from "../config/sourceSchemas";

import type {
    RegistroFuente
} from "./registrosFuente";


/*
 * Un requerimiento consolidado a partir de las filas de
 * los 3 Excels.
 *
 * Reglas de cruce (acordadas con el usuario):
 *
 * 1. Cada fila de Demanda Táctica es un requerimiento.
 *    Varios requerimientos pueden compartir mantenimiento
 *    (2026-M0013 tiene 4 trámites distintos).
 *
 * 2. Cada caso del Listado se une a los requerimientos
 *    de DT con el mismo trámite; si no tiene trámite o
 *    no hay coincidencia, a los que tengan su mismo
 *    mantenimiento. Si no encaja con ninguno, es un
 *    requerimiento propio.
 *
 * 3. Las actividades de ClearQuest se agrupan por
 *    mantenimiento (2024-M0243-A001 → 2024-M0243; los
 *    proyectos con P cuentan igual) y se unen a todos
 *    los requerimientos con ese mantenimiento. Si no
 *    encajan con ninguno, el mantenimiento es un
 *    requerimiento propio.
 *
 * 4. Lo que no tiene mantenimiento ni trámite se carga
 *    igual, identificado por su clave propia.
 */
export interface Requerimiento {
    id: string;

    idMantenimiento: string;
    idTramite: string;

    /*
     * Clave propia del registro principal
     * (ID Demanda en DT, Caso en Listado).
     */
    idDemanda: string;
    caso: string;

    nombre: string;
    estado: string;
    responsable: string;
    aplicacion: string;
    gerencia: string;

    /*
     * Año del mantenimiento o, si no tiene,
     * del trámite (2024-M0243 → 2024).
     */
    anio: string;

    fuentes: CodigoFuente[];

    demandaTactica: RegistroFuente | null;
    listado: RegistroFuente[];
    clearQuest: RegistroFuente[];

    /*
     * Otros requerimientos que comparten
     * el mismo mantenimiento.
     */
    compartenMantenimiento: number;

    alertas: string[];
}


const ORDEN_FUENTES: CodigoFuente[] = [
    "DT",
    "LS",
    "CQ"
];


function texto(
    valor: unknown
): string {
    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor).trim();
}


function agregarAIndice<T>(
    indice: Map<string, T[]>,
    clave: string | null,
    valor: T
) {
    if (!clave) {
        return;
    }

    const lista =
        indice.get(clave);

    if (lista) {
        lista.push(valor);
    } else {
        indice.set(clave, [valor]);
    }
}


function crearRequerimiento(
    id: string
): Requerimiento {
    return {
        id,
        idMantenimiento: "",
        idTramite: "",
        idDemanda: "",
        caso: "",
        nombre: "",
        estado: "",
        responsable: "",
        aplicacion: "",
        gerencia: "",
        anio: "",
        fuentes: [],
        demandaTactica: null,
        listado: [],
        clearQuest: [],
        compartenMantenimiento: 0,
        alertas: []
    };
}


/*
 * La última actividad de CQ (por ID de actividad)
 * representa el estado actual del mantenimiento.
 */
function ultimaActividad(
    actividades: RegistroFuente[]
): RegistroFuente | undefined {
    return [...actividades]
        .sort((a, b) =>
            texto(a.datos.id_mantenimiento)
                .localeCompare(
                    texto(b.datos.id_mantenimiento),
                    "es",
                    { numeric: true }
                )
        )
        .at(-1);
}


function completarResumen(
    requerimiento: Requerimiento
) {
    const dt =
        requerimiento.demandaTactica;

    const ls =
        requerimiento.listado[0];

    const cq =
        ultimaActividad(
            requerimiento.clearQuest
        );

    requerimiento.idMantenimiento =
        dt?.idMantenimiento ??
        requerimiento.listado.find(item => item.idMantenimiento)?.idMantenimiento ??
        cq?.idMantenimiento ??
        "";

    requerimiento.idTramite =
        dt?.idTramite ??
        requerimiento.listado.find(item => item.idTramite)?.idTramite ??
        "";

    requerimiento.idDemanda =
        texto(dt?.datos.id_demanda);

    requerimiento.caso =
        requerimiento.listado
            .map(item => item.clave)
            .join(", ");

    requerimiento.nombre =
        dt?.nombre ||
        ls?.nombre ||
        cq?.nombre ||
        "";

    requerimiento.estado =
        dt?.estado ||
        ls?.estado ||
        cq?.estado ||
        "";

    requerimiento.responsable =
        texto(dt?.datos.responsable_dt) ||
        texto(ls?.datos.analista_bn) ||
        texto(cq?.datos.analista_cq);

    requerimiento.aplicacion =
        texto(ls?.datos.aplicativo) ||
        texto(cq?.datos.aplicacion_cq);

    requerimiento.gerencia =
        texto(dt?.datos.gerencia) ||
        texto(ls?.datos.gerencia_usuaria);

    requerimiento.anio =
        (requerimiento.idMantenimiento || requerimiento.idTramite)
            .slice(0, 4);

    const fuentes =
        new Set<CodigoFuente>();

    if (dt) fuentes.add("DT");
    if (requerimiento.listado.length) fuentes.add("LS");
    if (requerimiento.clearQuest.length) fuentes.add("CQ");

    requerimiento.fuentes =
        ORDEN_FUENTES.filter(
            codigo =>
                fuentes.has(codigo)
        );
}


export function consolidarRequerimientos(
    registros: RegistroFuente[]
): Requerimiento[] {

    const activos =
        registros.filter(
            registro =>
                registro.activo
        );

    const requerimientos:
        Requerimiento[] = [];

    const porTramite =
        new Map<string, Requerimiento[]>();

    const porMantenimiento =
        new Map<string, Requerimiento[]>();


    // =====================================================
    // 1. DEMANDA TÁCTICA
    // =====================================================

    for (const registro of activos) {

        if (registro.codigoFuente !== "DT") {
            continue;
        }

        const requerimiento =
            crearRequerimiento(
                `DT:${registro.clave}`
            );

        requerimiento.demandaTactica =
            registro;

        requerimientos.push(
            requerimiento
        );

        agregarAIndice(
            porTramite,
            registro.idTramite,
            requerimiento
        );

        agregarAIndice(
            porMantenimiento,
            registro.idMantenimiento,
            requerimiento
        );
    }


    // =====================================================
    // 2. LISTADO
    // =====================================================

    for (const registro of activos) {

        if (registro.codigoFuente !== "LS") {
            continue;
        }

        let destinos =
            (registro.idTramite &&
                porTramite.get(registro.idTramite)) ||
            [];

        if (
            destinos.length === 0 &&
            registro.idMantenimiento
        ) {
            destinos =
                porMantenimiento.get(
                    registro.idMantenimiento
                ) ?? [];
        }


        if (destinos.length === 0) {

            const requerimiento =
                crearRequerimiento(
                    `LS:${registro.clave}`
                );

            requerimiento.listado.push(
                registro
            );

            requerimientos.push(
                requerimiento
            );

            agregarAIndice(
                porTramite,
                registro.idTramite,
                requerimiento
            );

            agregarAIndice(
                porMantenimiento,
                registro.idMantenimiento,
                requerimiento
            );

            continue;
        }


        for (const destino of destinos) {

            destino.listado.push(
                registro
            );

            const mantenimientoDt =
                destino.demandaTactica?.idMantenimiento;

            if (
                registro.idMantenimiento &&
                mantenimientoDt &&
                registro.idMantenimiento !== mantenimientoDt
            ) {
                destino.alertas.push(
                    `El Listado (${registro.clave}) indica el mantenimiento ` +
                    `${registro.idMantenimiento} y Demanda Táctica ${mantenimientoDt}.`
                );
            }

            /*
             * El Listado puede aportar el mantenimiento
             * que DT todavía no tiene; así ClearQuest
             * también se puede cruzar.
             */
            if (
                registro.idMantenimiento &&
                !mantenimientoDt
            ) {
                agregarAIndice(
                    porMantenimiento,
                    registro.idMantenimiento,
                    destino
                );
            }
        }
    }


    // =====================================================
    // 3. CLEARQUEST
    // =====================================================

    const actividadesPorMantenimiento =
        new Map<string, RegistroFuente[]>();

    for (const registro of activos) {

        if (registro.codigoFuente !== "CQ") {
            continue;
        }

        if (!registro.idMantenimiento) {

            const requerimiento =
                crearRequerimiento(
                    `CQ:${registro.clave}`
                );

            requerimiento.clearQuest.push(
                registro
            );

            requerimientos.push(
                requerimiento
            );

            continue;
        }

        agregarAIndice(
            actividadesPorMantenimiento,
            registro.idMantenimiento,
            registro
        );
    }


    for (
        const [mantenimiento, actividades]
        of actividadesPorMantenimiento
        ) {

        const destinos =
            new Set(
                porMantenimiento.get(
                    mantenimiento
                ) ?? []
            );

        if (destinos.size === 0) {

            const requerimiento =
                crearRequerimiento(
                    `CQ:${mantenimiento}`
                );

            requerimiento.clearQuest.push(
                ...actividades
            );

            requerimientos.push(
                requerimiento
            );

            continue;
        }

        for (const destino of destinos) {
            destino.clearQuest.push(
                ...actividades
            );
        }
    }


    // =====================================================
    // 4. RESUMEN
    // =====================================================

    for (const requerimiento of requerimientos) {
        completarResumen(
            requerimiento
        );
    }


    const conteoMantenimiento =
        new Map<string, number>();

    for (const requerimiento of requerimientos) {
        if (requerimiento.idMantenimiento) {
            conteoMantenimiento.set(
                requerimiento.idMantenimiento,
                (conteoMantenimiento.get(requerimiento.idMantenimiento) ?? 0) + 1
            );
        }
    }

    for (const requerimiento of requerimientos) {
        requerimiento.compartenMantenimiento =
            requerimiento.idMantenimiento
                ? (conteoMantenimiento.get(requerimiento.idMantenimiento) ?? 1) - 1
                : 0;
    }


    /*
     * Primero los más recientes por mantenimiento o
     * trámite; al final los que no tienen ninguno.
     */
    const claveOrden = (
        requerimiento: Requerimiento
    ): string =>
        requerimiento.idMantenimiento ||
        requerimiento.idTramite;

    return requerimientos.sort((a, b) => {
        const claveA = claveOrden(a);
        const claveB = claveOrden(b);

        if (!claveA || !claveB) {
            return Number(!claveA) - Number(!claveB);
        }

        return claveB.localeCompare(
            claveA,
            "es",
            { numeric: true }
        );
    });
}
