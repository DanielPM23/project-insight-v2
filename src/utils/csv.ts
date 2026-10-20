/*
 * Descarga de tablas en CSV.
 *
 * Se agrega el BOM UTF-8 para que Excel muestre bien las
 * tildes y la ñ al abrir el archivo con doble clic.
 */

export interface ColumnaCSV<T> {
    titulo: string;
    valor: (fila: T) => string | number | null | undefined;
}


function celda(
    valor: string | number | null | undefined
): string {
    const texto =
        String(valor ?? "");

    return /[",\r\n]/.test(texto)
        ? `"${texto.replace(/"/g, '""')}"`
        : texto;
}


export function generarCSV<T>(
    columnas: ColumnaCSV<T>[],
    filas: T[]
): string {
    const lineas = [
        columnas.map(columna => celda(columna.titulo)).join(","),
        ...filas.map(fila =>
            columnas.map(columna => celda(columna.valor(fila))).join(",")
        )
    ];

    return lineas.join("\r\n");
}


export function descargarCSV<T>(
    nombreArchivo: string,
    columnas: ColumnaCSV<T>[],
    filas: T[]
): void {
    const blob =
        new Blob(["﻿" + generarCSV(columnas, filas)], { type: "text/csv;charset=utf-8;" });

    const url =
        URL.createObjectURL(blob);

    const enlace =
        document.createElement("a");

    enlace.href = url;
    enlace.download = `${nombreArchivo}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
}
