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
 * 2. El cruce busca primero por ID Mantenimiento y, si el
 *    registro no lo tiene o nadie más lo tiene, por ID
 *    Trámite. Ambos se comparan exactos tras normalizarlos
 *    (utils/identificadores). Si el mantenimiento coincide
 *    con varios requerimientos y el trámite señala a uno de
 *    ellos, se une solo a ese; el trámite nunca une con un
 *    requerimiento de otro mantenimiento si hubo match por
 *    mantenimiento.
 *
 * 3. Cada caso del Listado se une así a los requerimientos
 *    de DT. Si no encaja con ninguno, es un requerimiento
 *    propio. Cada caso se ve en su propia fila: si el
 *    requerimiento ya tiene un caso, el siguiente va en una
 *    copia con los mismos datos de DT.
 *
 * 4. Cada registro de ClearQuest se une igual a DT o al
 *    Listado (2024-M0243-A001 → 2024-M0243; los proyectos
 *    con P cuentan igual). Los que no encajan se agrupan
 *    por mantenimiento en un requerimiento propio.
 *
 * 5. Lo que no tiene mantenimiento ni trámite se carga
 *    igual, identificado por su clave propia.
 */

export type TipoMatch =
    | "Match por ID Mantenimiento"
    | "Match por ID Trámite"
    | "Sin Match";

interface Vinculo {
    fuente: "LS" | "CQ";
    tipo: "MANTENIMIENTO" | "TRAMITE";
}

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

    /*
     * ID Histórico de Demanda Táctica (clave de su fila).
     */
    idHistorico: string;

    nombre: string;

    /*
     * Estado principal: el de DT y, si no está en DT, el del
     * Listado o el de ClearQuest.
     */
    estado: string;

    /*
     * Estado propio del Listado. Se muestra aparte porque, si el
     * requerimiento está en DT, el estado principal es el de DT.
     */
    estadoListado: string;

    /*
     * Estado de la última actividad en ClearQuest (Finalizada,
     * Asignada...). Si no está en CQ, la "Última Actividad CQ"
     * de DT.
     */
    estadoActividad: string;

    responsable: string;
    aplicacion: string;
    gerencia: string;

    /*
     * Recurso que atiende el requerimiento según DT
     * (Fábrica Ayesa, Recurso BN, Proveedor).
     */
    recurso: string;

    /*
     * Categoría del requerimiento (Evolutivo, Correctivo,
     * Normativo...), de DT o, si no tiene, del Listado.
     */
    categoria: string;

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

    /*
     * Id del requerimiento de DT del que esta fila es copia
     * porque comparte trámite o mantenimiento con otro caso
     * del Listado. Vacío en el resto.
     */
    copiaDe: string;

    /*
     * Cómo se unieron las fuentes: por mantenimiento si
     * todas se cruzaron por mantenimiento, por trámite si
     * alguna necesitó el trámite, sin match si solo hay una
     * fuente. El detalle dice qué fuente usó cada ID.
     */
    tipoMatch: TipoMatch;
    detalleMatch: string;
    vinculos: Vinculo[];

    /*
     * En qué archivos aparece: "DT + Listado + CQ",
     * "DT + CQ"... "Solo CQ".
     */
    cobertura: string;

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


/*
 * La categoría está en el esquema del Listado y como columna
 * adicional en DT. Algunas filas traen "0" como vacío.
 */
function categoria(
    registro: RegistroFuente | null | undefined
): string {
    if (!registro) {
        return "";
    }

    const valor =
        texto(
            registro.datos.categoria ??
            registro.extra["Categoría"] ??
            registro.extra["Categoria"]
        );

    if (!valor || valor === "0") {
        return "";
    }

    return valor.charAt(0).toUpperCase() + valor.slice(1);
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
        idHistorico: "",
        nombre: "",
        estado: "",
        estadoListado: "",
        estadoActividad: "",
        responsable: "",
        aplicacion: "",
        gerencia: "",
        recurso: "",
        categoria: "",
        anio: "",
        fuentes: [],
        demandaTactica: null,
        listado: [],
        clearQuest: [],
        compartenMantenimiento: 0,
        copiaDe: "",
        tipoMatch: "Sin Match",
        cobertura: "",
        detalleMatch: "",
        vinculos: [],
        alertas: []
    };
}


/*
 * La última actividad de CQ representa el estado actual del
 * mantenimiento: por ID de actividad en el reporte antiguo
 * (2024-M0001-A002) y por trámite en el nuevo.
 */
function ultimaActividad(
    actividades: RegistroFuente[]
): RegistroFuente | undefined {
    const orden = (registro: RegistroFuente) =>
        `${texto(registro.datos.id_mantenimiento)} ${registro.idTramite ?? ""}`;

    return [...actividades]
        .sort((a, b) =>
            orden(a).localeCompare(
                orden(b),
                "es",
                { numeric: true }
            )
        )
        .at(-1);
}


function unirValores(
    valores: string[]
): string {
    return Array.from(
        new Set(
            valores
                .map(valor => valor.trim())
                .filter(Boolean)
        )
    ).join(" / ");
}


/*
 * Estados de actividad de los trámites de CQ. "Sin coincidencia"
 * solo se muestra si ningún trámite tiene actividad.
 */
const SIN_ACTIVIDAD =
    "sin coincidencia";

function estadoActividad(
    tramites: RegistroFuente[]
): string {
    const estados =
        tramites.map(tramite => texto(tramite.datos.estado_actividad_cq));

    const conActividad =
        estados.filter(estado => estado.toLowerCase() !== SIN_ACTIVIDAD);

    return unirValores(
        conActividad.some(Boolean)
            ? conActividad
            : estados
    );
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
        cq?.idTramite ??
        "";

    requerimiento.idDemanda =
        texto(dt?.datos.id_demanda);

    requerimiento.idHistorico =
        texto(dt?.datos.id_historico);

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

    requerimiento.estadoListado =
        Array.from(
            new Set(
                requerimiento.listado
                    .map(item => item.estado)
                    .filter(Boolean)
            )
        ).join(" / ");

    requerimiento.estadoActividad =
        estadoActividad(requerimiento.clearQuest) ||
        unirValores(texto(dt?.datos.ultima_actividad_cq).split(","));

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

    requerimiento.recurso =
        texto(dt?.datos.recurso);

    requerimiento.categoria =
        categoria(dt) ||
        categoria(ls);

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

    completarMatch(
        requerimiento
    );
}


const NOMBRE_FUENTE_MATCH: Record<Vinculo["fuente"], string> = {
    LS: "Listado",
    CQ: "ClearQuest"
};


function completarMatch(
    requerimiento: Requerimiento
) {
    const nombres =
        requerimiento.fuentes.map(fuente => fuente === "LS" ? "Listado" : fuente);

    requerimiento.cobertura =
        nombres.length === 1
            ? `Solo ${nombres[0]}`
            : nombres.join(" + ");

    if (requerimiento.fuentes.length < 2) {
        requerimiento.tipoMatch = "Sin Match";
        requerimiento.detalleMatch = "";
        return;
    }

    /*
     * Un requerimiento sin DT une Listado y ClearQuest
     * a través del caso del Listado.
     */
    const vinculos =
        requerimiento.vinculos;

    const tipos =
        new Set(vinculos.map(vinculo => vinculo.tipo));

    requerimiento.tipoMatch =
        tipos.has("TRAMITE")
            ? "Match por ID Trámite"
            : "Match por ID Mantenimiento";

    requerimiento.detalleMatch =
        (["LS", "CQ"] as const)
            .map(fuente => {
                const propios =
                    new Set(
                        vinculos
                            .filter(vinculo => vinculo.fuente === fuente)
                            .map(vinculo => vinculo.tipo === "TRAMITE" ? "trámite" : "mantenimiento")
                    );

                return propios.size
                    ? `${NOMBRE_FUENTE_MATCH[fuente]} por ${Array.from(propios).join(" y ")}`
                    : "";
            })
            .filter(Boolean)
            .join(", ");
}


function tramiteDe(
    requerimiento: Requerimiento
): string | null {
    return requerimiento.demandaTactica
        ? requerimiento.demandaTactica.idTramite
        : requerimiento.listado[0]?.idTramite ?? null;
}


/*
 * Requerimientos con los que se cruza un registro:
 * primero por mantenimiento y, si no hay, por trámite.
 */
function buscarDestinos(
    registro: RegistroFuente,
    porMantenimiento: Map<string, Requerimiento[]>,
    porTramite: Map<string, Requerimiento[]>
): {
    destinos: Requerimiento[];
    tipo: Vinculo["tipo"] | null;
} {
    const conMantenimiento =
        registro.idMantenimiento
            ? Array.from(new Set(porMantenimiento.get(registro.idMantenimiento) ?? []))
            : [];

    if (conMantenimiento.length > 0) {
        const mismoTramite =
            registro.idTramite && conMantenimiento.length > 1
                ? conMantenimiento.filter(
                    destino =>
                        tramiteDe(destino) === registro.idTramite
                )
                : [];

        return {
            destinos: mismoTramite.length ? mismoTramite : conMantenimiento,
            tipo: "MANTENIMIENTO"
        };
    }

    const conTramite =
        registro.idTramite
            ? Array.from(new Set(porTramite.get(registro.idTramite) ?? []))
            : [];

    return {
        destinos: conTramite,
        tipo: conTramite.length ? "TRAMITE" : null
    };
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

    const pendientesDeIndice: {
        requerimiento: Requerimiento;
        registro: RegistroFuente;
    }[] = [];

    for (const registro of activos) {

        if (registro.codigoFuente !== "LS") {
            continue;
        }

        const {
            destinos,
            tipo
        } = buscarDestinos(
            registro,
            porMantenimiento,
            porTramite
        );


        /*
         * Los casos que comparten trámite o mantenimiento con un
         * caso anterior van en su propia fila. Se indexan al
         * terminar el Listado para que los casos siguientes no
         * se crucen con ellas.
         */
        const conCaso =
            destinos.filter(
                destino =>
                    destino.listado.length > 0
            );

        const libres =
            destinos.filter(
                destino =>
                    destino.listado.length === 0
            );

        const nuevos: Requerimiento[] = [];

        for (const base of conCaso) {
            if (!base.demandaTactica) {
                continue;
            }

            const copia =
                crearRequerimiento(
                    `${base.id}|LS:${registro.clave}`
                );

            copia.copiaDe =
                base.id;

            copia.demandaTactica =
                base.demandaTactica;

            nuevos.push(copia);
        }

        if (
            destinos.length === 0 ||
            (libres.length === 0 && nuevos.length === 0)
        ) {
            nuevos.push(
                crearRequerimiento(
                    `LS:${registro.clave}`
                )
            );
        }

        for (const nuevo of nuevos) {
            requerimientos.push(nuevo);
            pendientesDeIndice.push({
                requerimiento: nuevo,
                registro
            });
        }


        for (const destino of [...libres, ...nuevos]) {

            destino.listado.push(
                registro
            );

            if (destino.demandaTactica && tipo) {
                destino.vinculos.push({
                    fuente: "LS",
                    tipo
                });
            }

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
                !mantenimientoDt &&
                !nuevos.includes(destino)
            ) {
                agregarAIndice(
                    porMantenimiento,
                    registro.idMantenimiento,
                    destino
                );
            }
        }
    }

    for (const { requerimiento, registro } of pendientesDeIndice) {
        const dt =
            requerimiento.demandaTactica;

        agregarAIndice(
            porTramite,
            dt ? dt.idTramite : registro.idTramite,
            requerimiento
        );

        agregarAIndice(
            porMantenimiento,
            dt?.idMantenimiento ?? registro.idMantenimiento,
            requerimiento
        );
    }


    // =====================================================
    // 3. CLEARQUEST
    // =====================================================

    const sinCruce =
        new Map<string, RegistroFuente[]>();

    for (const registro of activos) {

        if (registro.codigoFuente !== "CQ") {
            continue;
        }

        const {
            destinos,
            tipo
        } = buscarDestinos(
            registro,
            porMantenimiento,
            porTramite
        );

        if (destinos.length > 0 && tipo) {
            for (const destino of destinos) {
                destino.clearQuest.push(
                    registro
                );

                destino.vinculos.push({
                    fuente: "CQ",
                    tipo
                });
            }

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
            sinCruce,
            registro.idMantenimiento,
            registro
        );
    }


    for (
        const [mantenimiento, actividades]
        of sinCruce
        ) {

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
