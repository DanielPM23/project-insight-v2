import type { AnalisisExcel } from "../models/ExcelAnalysis";

type Respuesta =
    | { ok: true; resultado: AnalisisExcel }
    | { ok: false; error: string };


/*
 * Analiza el Excel en un Web Worker. Si el navegador no
 * puede crear el worker, se analiza en el hilo principal
 * como antes (la página se congela mientras dura).
 */
export async function analizarExcelEnSegundoPlano(
    archivo: File
): Promise<AnalisisExcel> {
    let worker: Worker;

    try {
        worker = new Worker(
            new URL("../workers/excelAnalyzer.worker.ts", import.meta.url),
            { type: "module" }
        );
    } catch {
        return analizarEnHiloPrincipal(archivo);
    }

    try {
        return await new Promise<AnalisisExcel>((resolver, rechazar) => {
            worker.onmessage = (evento: MessageEvent<Respuesta>) => {
                if (evento.data.ok) {
                    resolver(evento.data.resultado);
                } else {
                    rechazar(new Error(evento.data.error));
                }
            };

            // El worker no llegó a cargar: se reintenta sin él.
            worker.onerror = evento => {
                evento.preventDefault();
                analizarEnHiloPrincipal(archivo).then(resolver, rechazar);
            };

            worker.postMessage(archivo);
        });
    } finally {
        worker.terminate();
    }
}


async function analizarEnHiloPrincipal(
    archivo: File
): Promise<AnalisisExcel> {
    const { analizarExcel } = await import("./excelAnalyzerService");

    return analizarExcel(archivo);
}
