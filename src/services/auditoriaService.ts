import {
    collection,
    documentId,
    getDocs,
    limit,
    orderBy,
    query,
    where
} from "firebase/firestore";

import {
    auth,
    db
} from "../firebase/firebase";

import {
    FUENTES
} from "../config/sourceSchemas";

import type {
    CodigoFuente,
    FuenteConocida
} from "../config/sourceSchemas";

import {
    COLLECTION_CAMBIOS,
    COLLECTION_CARGAS
} from "./registrosFuente";

import type {
    RegistroFuente
} from "./registrosFuente";

import {
    formatearFecha
} from "../utils/fechas";


/*
 * Auditoría de cargas.
 *
 * - cargas_v3/{idCarga}: una por archivo cargado, con su
 *   fuente, usuario, fecha y conteos (nuevos, modificados,
 *   reactivados, sin cambios, inactivados).
 * - cambios_v3/{idCarga}__{idDocumento}: uno por registro
 *   que cambió en esa carga, con los campos que cambiaron
 *   (valor anterior y nuevo). Los registros sin cambios no
 *   generan documento.
 *
 * Así se consulta qué cambió en una carga (por id_carga) y
 * la historia de un requerimiento (por id_documento) sin
 * índices compuestos.
 */


// =========================================================
// TIPOS
// =========================================================

export type TipoCambio =
    "NUEVO" |
    "MODIFICADO" |
    "REACTIVADO" |
    "INACTIVADO";


export const TIPOS_CAMBIO: Record<TipoCambio, {
    nombre: string;
    icono: string;
    severidad: "success" | "info" | "warn" | "secondary";
}> = {
    NUEVO: { nombre: "Nuevo", icono: "pi pi-plus", severidad: "success" },
    MODIFICADO: { nombre: "Modificado", icono: "pi pi-pencil", severidad: "info" },
    REACTIVADO: { nombre: "Reactivado", icono: "pi pi-replay", severidad: "warn" },
    INACTIVADO: { nombre: "Inactivado", icono: "pi pi-minus-circle", severidad: "secondary" }
};


export interface CampoCambiado {
    campo: string;
    etiqueta: string;
    anterior: unknown;
    nuevo: unknown;
}


export interface UsuarioCarga {
    uid: string;
    email: string;
}


export interface CambioRegistro {
    id: string;
    idCarga: string;
    fuente: FuenteConocida;
    codigoFuente: CodigoFuente;
    idDocumento: string;
    clave: string;
    idMantenimiento: string;
    idTramite: string;
    nombre: string;
    tipo: TipoCambio;
    campos: CampoCambiado[];
    fecha: Date | null;
    usuario: UsuarioCarga | null;
}


/*
 * Cambio de la fecha final de desarrollo, guardado en la
 * carga para calcular la alerta "fecha modificada
 * recientemente" sin leer cambios_v3.
 */
export interface CambioFechaFin {
    idDocumento: string;
    idMantenimiento: string;
    anterior: string | null;
    nuevo: string | null;
}


export interface Carga {
    id: string;
    tipo: "BASELINE" | "ACTUALIZACION";
    fuente: FuenteConocida;
    codigoFuente: CodigoFuente;
    archivo: string;
    hoja: string;
    estado: string;
    total: number;
    nuevos: number;
    modificados: number;
    reactivados: number;
    sinCambios: number;
    inactivos: number;
    fecha: Date | null;
    usuario: UsuarioCarga | null;
    fechasFinModificadas: CambioFechaFin[];
}


// =========================================================
// CAMPOS
// =========================================================

export const PREFIJO_EXTRA =
    "extra.";


/*
 * Nombre legible de un campo: el primer alias del esquema
 * (el nombre de la columna en el Excel) o, para columnas
 * adicionales, su propio nombre.
 */
export function etiquetaCampo(
    fuente: FuenteConocida,
    campo: string
): string {
    if (campo.startsWith(PREFIJO_EXTRA)) {
        return campo.slice(PREFIJO_EXTRA.length);
    }

    return FUENTES[fuente].campos[campo]?.aliases[0] ?? campo;
}


/*
 * Valor normalizado para comparar y guardar: fechas en
 * ISO, textos sin espacios a los lados y vacíos como null
 * (una celda vacía y "" son lo mismo).
 */
export function valorComparable(
    valor: unknown
): unknown {
    if (valor === undefined || valor === null) {
        return null;
    }

    if (valor instanceof Date) {
        return Number.isNaN(valor.getTime())
            ? null
            : valor.toISOString();
    }

    if (typeof valor === "object") {
        const posibleTimestamp =
            valor as { toDate?: () => Date };

        if (typeof posibleTimestamp.toDate === "function") {
            return posibleTimestamp.toDate().toISOString();
        }

        if (Array.isArray(valor)) {
            return valor.map(valorComparable);
        }

        const objeto =
            valor as Record<string, unknown>;

        const normalizado: Record<string, unknown> = {};

        for (const clave of Object.keys(objeto).sort()) {
            normalizado[clave] = valorComparable(objeto[clave]);
        }

        return normalizado;
    }

    if (typeof valor === "string") {
        const texto =
            valor.trim();

        return texto === ""
            ? null
            : texto;
    }

    return valor;
}


function iguales(
    a: unknown,
    b: unknown
): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}


/*
 * Campos que cambiaron entre dos versiones de un registro:
 * los del esquema por su nombre y las columnas adicionales
 * como "extra.<columna>".
 */
export function camposCambiados(
    anterior: Pick<RegistroFuente, "datos" | "extra">,
    nuevo: Pick<RegistroFuente, "datos" | "extra">,
    fuente: FuenteConocida
): CampoCambiado[] {
    const plano = (
        registro: Pick<RegistroFuente, "datos" | "extra">
    ): Record<string, unknown> => {
        const resultado: Record<string, unknown> = {
            ...registro.datos
        };

        for (const [columna, valor] of Object.entries(registro.extra)) {
            resultado[PREFIJO_EXTRA + columna] = valor;
        }

        return resultado;
    };

    const valoresAnteriores =
        plano(anterior);

    const valoresNuevos =
        plano(nuevo);

    const campos =
        new Set([
            ...Object.keys(valoresAnteriores),
            ...Object.keys(valoresNuevos)
        ]);

    const cambios: CampoCambiado[] = [];

    for (const campo of campos) {
        const valorAnterior =
            valorComparable(valoresAnteriores[campo]);

        const valorNuevo =
            valorComparable(valoresNuevos[campo]);

        if (!iguales(valorAnterior, valorNuevo)) {
            cambios.push({
                campo,
                etiqueta: etiquetaCampo(fuente, campo),
                anterior: valorAnterior,
                nuevo: valorNuevo
            });
        }
    }

    // Primero los campos del esquema, luego los adicionales.
    return cambios.sort((a, b) =>
        Number(a.campo.startsWith(PREFIJO_EXTRA)) - Number(b.campo.startsWith(PREFIJO_EXTRA)) ||
        a.etiqueta.localeCompare(b.etiqueta, "es")
    );
}


const PATRON_ISO =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;


/*
 * Texto para mostrar un valor guardado en la auditoría.
 */
export function valorLegible(
    valor: unknown
): string {
    if (valor === null || valor === undefined || valor === "") {
        return "—";
    }

    if (typeof valor === "string" && PATRON_ISO.test(valor)) {
        const fecha =
            new Date(valor);

        const conHora =
            !valor.includes("T00:00:00") && !valor.includes("T05:00:00");

        return conHora
            ? fecha.toLocaleString("es-PE")
            : formatearFecha(
                new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())
            );
    }

    if (typeof valor === "object") {
        return JSON.stringify(valor);
    }

    return String(valor);
}


export function usuarioActual(): UsuarioCarga | null {
    const usuario =
        auth.currentUser;

    return usuario
        ? { uid: usuario.uid, email: usuario.email ?? "" }
        : null;
}


// =========================================================
// LECTURA
// =========================================================

function aFecha(
    valor: unknown
): Date | null {
    if (valor instanceof Date) {
        return valor;
    }

    if (
        valor &&
        typeof valor === "object" &&
        typeof (valor as { toDate?: unknown }).toDate === "function"
    ) {
        return (valor as { toDate: () => Date }).toDate();
    }

    return null;
}


function aUsuario(
    valor: unknown
): UsuarioCarga | null {
    if (!valor || typeof valor !== "object") {
        return null;
    }

    const datos =
        valor as Record<string, unknown>;

    return {
        uid: String(datos.uid ?? ""),
        email: String(datos.email ?? "")
    };
}


function esFuente(
    valor: unknown
): valor is FuenteConocida {
    return typeof valor === "string" && valor in FUENTES;
}


function leerCarga(
    id: string,
    data: Record<string, unknown>
): Carga | null {
    if (!esFuente(data.fuente)) {
        return null;
    }

    const numero = (
        valor: unknown
    ): number =>
        typeof valor === "number"
            ? valor
            : 0;

    return {
        id,
        tipo: data.tipo === "BASELINE" ? "BASELINE" : "ACTUALIZACION",
        fuente: data.fuente,
        codigoFuente: FUENTES[data.fuente].codigo,
        archivo: String(data.archivo ?? ""),
        hoja: String(data.hoja ?? ""),
        estado: String(data.estado ?? ""),
        total: numero(data.registros_total),
        nuevos: numero(data.nuevos),
        modificados: numero(data.modificados),
        reactivados: numero(data.reactivados),
        sinCambios: numero(data.sin_cambios),
        inactivos: numero(data.inactivos),
        fecha: aFecha(data.fecha_carga),
        usuario: aUsuario(data.usuario),
        fechasFinModificadas: Array.isArray(data.fechas_fin_modificadas)
            ? data.fechas_fin_modificadas as CambioFechaFin[]
            : []
    };
}


function leerCambio(
    id: string,
    data: Record<string, unknown>
): CambioRegistro | null {
    if (!esFuente(data.fuente)) {
        return null;
    }

    const tipo =
        String(data.tipo) as TipoCambio;

    return {
        id,
        idCarga: String(data.id_carga ?? ""),
        fuente: data.fuente,
        codigoFuente: FUENTES[data.fuente].codigo,
        idDocumento: String(data.id_documento ?? ""),
        clave: String(data.clave ?? ""),
        idMantenimiento: String(data.id_mantenimiento ?? ""),
        idTramite: String(data.id_tramite ?? ""),
        nombre: String(data.nombre ?? ""),
        tipo: tipo in TIPOS_CAMBIO ? tipo : "MODIFICADO",
        campos: Array.isArray(data.campos)
            ? data.campos as CampoCambiado[]
            : [],
        fecha: aFecha(data.fecha),
        usuario: aUsuario(data.usuario)
    };
}


function porFechaDesc<T extends { fecha: Date | null }>(
    a: T,
    b: T
): number {
    return (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0);
}


/*
 * Últimas cargas de todas las fuentes, más recientes
 * primero.
 */
export async function listarCargas(
    limite = 50
): Promise<Carga[]> {
    const snapshot =
        await getDocs(
            query(
                collection(db, COLLECTION_CARGAS),
                orderBy("fecha_carga", "desc"),
                limit(limite)
            )
        );

    return snapshot.docs
        .map(item => leerCarga(item.id, item.data()))
        .filter((item): item is Carga => item !== null);
}


export async function obtenerCargas(
    ids: string[]
): Promise<Carga[]> {
    const resultado: Carga[] = [];

    for (let inicio = 0; inicio < ids.length; inicio += 30) {
        const snapshot =
            await getDocs(
                query(
                    collection(db, COLLECTION_CARGAS),
                    where(documentId(), "in", ids.slice(inicio, inicio + 30))
                )
            );

        for (const item of snapshot.docs) {
            const carga =
                leerCarga(item.id, item.data());

            if (carga) {
                resultado.push(carga);
            }
        }
    }

    return resultado.sort(porFechaDesc);
}


export async function listarCambiosDeCarga(
    idCarga: string
): Promise<CambioRegistro[]> {
    const snapshot =
        await getDocs(
            query(
                collection(db, COLLECTION_CAMBIOS),
                where("id_carga", "==", idCarga)
            )
        );

    return snapshot.docs
        .map(item => leerCambio(item.id, item.data()))
        .filter((item): item is CambioRegistro => item !== null);
}


/*
 * Historia de uno o varios registros de las fuentes (por
 * ejemplo, la fila de DT, los casos del Listado y las
 * actividades de CQ de un requerimiento).
 */
export async function listarCambiosDeRegistros(
    idsDocumento: string[]
): Promise<CambioRegistro[]> {
    const ids =
        Array.from(new Set(idsDocumento.filter(Boolean)));

    const resultado: CambioRegistro[] = [];

    for (let inicio = 0; inicio < ids.length; inicio += 30) {
        const snapshot =
            await getDocs(
                query(
                    collection(db, COLLECTION_CAMBIOS),
                    where("id_documento", "in", ids.slice(inicio, inicio + 30))
                )
            );

        for (const item of snapshot.docs) {
            const cambio =
                leerCambio(item.id, item.data());

            if (cambio) {
                resultado.push(cambio);
            }
        }
    }

    return resultado.sort(porFechaDesc);
}
