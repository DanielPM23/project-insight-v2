/*
 * Normalización de los IDs que cruzan las fuentes.
 *
 * Mantenimiento / proyecto: 2024-M0243, 2024-P0481
 *   - ClearQuest agrega la actividad: 2024-M0243-A001
 *   - Algunos Excels traen espacios: "2026- M0340"
 *
 * Trámite: 2026-T0337
 *
 * Si el valor no tiene el formato esperado se devuelve
 * null: es mejor no cruzar que cruzar con un valor
 * cualquiera ("Por definir", "No aplica"...).
 */

const PATRON_MANTENIMIENTO =
    /^(\d{4})-?([MP])(\d{1,6})(?:-A\d+)?$/;

const PATRON_TRAMITE =
    /^(\d{4})-?T(\d{1,6})$/;


function compactar(
    valor: unknown
): string {
    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor)
        .toUpperCase()
        .replace(/\s+/g, "");
}


export function normalizarIdMantenimiento(
    valor: unknown
): string | null {
    const coincidencia =
        PATRON_MANTENIMIENTO.exec(
            compactar(valor)
        );

    if (!coincidencia) {
        return null;
    }

    const [, anio, tipo, numero] =
        coincidencia;

    return `${anio}-${tipo}${numero!.padStart(4, "0")}`;
}


export function normalizarIdTramite(
    valor: unknown
): string | null {
    const coincidencia =
        PATRON_TRAMITE.exec(
            compactar(valor)
        );

    if (!coincidencia) {
        return null;
    }

    const [, anio, numero] =
        coincidencia;

    return `${anio}-T${numero!.padStart(4, "0")}`;
}


/*
 * Clave propia de una fila dentro de su Excel
 * (ID Histórico, id de ClearQuest, Caso...).
 */
export function limpiarClave(
    valor: unknown
): string {
    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor)
        .trim()
        .toUpperCase();
}


/*
 * Firestore no admite "/" en el ID de un documento.
 */
export function limpiarIdDocumento(
    valor: string
): string {
    return valor
        .trim()
        .replace(/\//g, "-");
}


/*
 * Primer campo clave con valor (por ejemplo ID Histórico
 * y, si no viene, ID Demanda).
 */
export function obtenerClaveRegistro(
    registro: Record<string, unknown>,
    camposClave: string[]
): string {
    for (const campo of camposClave) {
        const clave =
            limpiarClave(
                registro[campo]
            );

        if (clave) {
            return clave;
        }
    }

    return "";
}
