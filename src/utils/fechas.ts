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
