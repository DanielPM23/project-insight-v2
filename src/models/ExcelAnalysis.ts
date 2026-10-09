import type {
    FuenteDatos
} from "../config/sourceSchemas";


export interface CampoDetectado {
    campoCanonico: string;
    columnaExcel: string;
    indiceColumna: number;
    obligatorio: boolean;
}


export interface AnalisisExcel {
    archivo: string;

    fuente: FuenteDatos;

    nombreFuente: string;

    confianzaFuente: number;

    hoja: string;

    filaCabecera: number;

    totalRegistros: number;

    totalColumnas: number;

    camposDetectados: CampoDetectado[];

    camposObligatoriosFaltantes: string[];

    columnasNoReconocidas: string[];

    registros: Record<string, unknown>[];
}

/*
 * Cada registro analizado guarda aquí las columnas del
 * Excel que no están en el esquema de la fuente
 * (cabecera original → valor).
 */
export const CAMPO_EXTRA =
    "_extra";
