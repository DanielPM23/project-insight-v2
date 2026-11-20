/*
 * Lee y analiza el Excel fuera del hilo principal: así la
 * página sigue respondiendo mientras SheetJS descomprime y
 * recorre el libro (varios segundos con el Portafolio de
 * Demanda Táctica).
 */
import { analizarExcel } from "../services/excelAnalyzerService";

self.onmessage = async (evento: MessageEvent<File>) => {
    try {
        const resultado = await analizarExcel(evento.data);
        self.postMessage({ ok: true, resultado });
    } catch (e) {
        self.postMessage({
            ok: false,
            error: e instanceof Error ? e.message : "Ocurrió un error al analizar el archivo."
        });
    }
};
