/*
 * Convierte las fechas que llegan como texto desde los Excels:
 *
 *   ClearQuest: "3 de febrero de 2024 00:00:00 GMT-05:00"
 *   Listado:    "02/10/2026 9:12:41"  (día/mes/año)
 *
 * Si el valor ya es Date (SheetJS con cellDates) se
 * devuelve tal cual. Si no se reconoce el formato se
 * devuelve el valor original para no perder información.
 */

const MESES: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11
};

const PATRON_TEXTO_ES =
    /^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\s*GMT([+-]\d{2}):?(\d{2}))?/i;

const PATRON_DIA_MES_ANIO =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;


function crearFecha(
    anio: number,
    mes: number,
    dia: number,
    hora: number,
    minuto: number,
    segundo: number,
    offsetMinutos: number | null
): Date | null {
    const fecha =
        offsetMinutos === null
            ? new Date(anio, mes, dia, hora, minuto, segundo)
            : new Date(
                Date.UTC(anio, mes, dia, hora, minuto, segundo) -
                offsetMinutos * 60_000
            );

    return Number.isNaN(fecha.getTime())
        ? null
        : fecha;
}


export function parsearFecha(
    valor: unknown
): unknown {
    if (
        valor instanceof Date ||
        typeof valor !== "string"
    ) {
        return valor;
    }

    const texto =
        valor.trim();

    const textoEs =
        PATRON_TEXTO_ES.exec(texto);

    if (textoEs) {
        const mes =
            MESES[textoEs[2]!.toLowerCase()];

        if (mes === undefined) {
            return valor;
        }

        let offset: number | null =
            null;

        if (textoEs[7]) {
            const horas =
                Number(textoEs[7]);

            const signo =
                textoEs[7].startsWith("-")
                    ? -1
                    : 1;

            offset =
                horas * 60 +
                signo * Number(textoEs[8] ?? 0);
        }

        return crearFecha(
            Number(textoEs[3]),
            mes,
            Number(textoEs[1]),
            Number(textoEs[4] ?? 0),
            Number(textoEs[5] ?? 0),
            Number(textoEs[6] ?? 0),
            offset
        ) ?? valor;
    }

    const diaMesAnio =
        PATRON_DIA_MES_ANIO.exec(texto);

    if (diaMesAnio) {
        return crearFecha(
            Number(diaMesAnio[3]),
            Number(diaMesAnio[2]) - 1,
            Number(diaMesAnio[1]),
            Number(diaMesAnio[4] ?? 0),
            Number(diaMesAnio[5] ?? 0),
            Number(diaMesAnio[6] ?? 0),
            null
        ) ?? valor;
    }

    return valor;
}


/*
 * Excel cuenta los días desde el 30/12/1899.
 */
const EPOCA_EXCEL_UTC =
    Date.UTC(1899, 11, 30);

const MS_DIA =
    86_400_000;


/*
 * Día de calendario (medianoche local) de un valor que
 * puede venir como Date, Timestamp de Firestore, número
 * de serie de Excel o texto. Devuelve null si no es una
 * fecha válida.
 *
 * SheetJS entrega las fechas sin hora a medianoche UTC;
 * en ese caso se toma el día UTC para no correrlo al día
 * anterior en Lima (UTC-5).
 */
export function aDiaCalendario(
    valor: unknown
): Date | null {
    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return null;
    }

    let fecha: Date | null =
        null;

    if (valor instanceof Date) {
        fecha = valor;
    } else if (
        typeof valor === "object" &&
        typeof (valor as { toDate?: unknown }).toDate === "function"
    ) {
        fecha = (valor as { toDate: () => Date }).toDate();
    } else if (typeof valor === "number") {
        // Solo números con pinta de fecha (años 1982 a 2173).
        if (valor < 30000 || valor > 100000) {
            return null;
        }

        fecha = new Date(EPOCA_EXCEL_UTC + Math.round(valor) * MS_DIA);
    } else if (typeof valor === "string") {
        const texto =
            valor.trim();

        if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
            fecha = new Date(texto);
        } else {
            const parseado =
                parsearFecha(texto);

            fecha = parseado instanceof Date
                ? parseado
                : null;
        }
    }

    if (!fecha || Number.isNaN(fecha.getTime())) {
        return null;
    }

    /*
     * Celdas con números chicos (0, 40, 93) y formato de
     * fecha salen como días de 1900: no son fechas reales.
     */
    const anio =
        fecha.getUTCFullYear();

    if (anio < 2000 || anio > 2100) {
        return null;
    }

    const esMedianocheUtc =
        fecha.getUTCHours() === 0 &&
        fecha.getUTCMinutes() === 0 &&
        fecha.getUTCSeconds() === 0;

    return esMedianocheUtc
        ? new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())
        : new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}


/*
 * Días de calendario de "desde" a "hasta" (negativo si
 * "hasta" ya pasó).
 */
export function diasEntre(
    desde: Date,
    hasta: Date
): number {
    const inicio =
        Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate());

    const fin =
        Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());

    return Math.round((fin - inicio) / MS_DIA);
}


export function formatearFecha(
    fecha: Date | null
): string {
    return fecha
        ? fecha.toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        })
        : "";
}


export function formatearFechaHora(
    fecha: Date | null
): string {
    return fecha
        ? fecha.toLocaleString("es-PE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
        : "";
}
