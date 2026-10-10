import { defineStore, storeToRefs } from "pinia";
import { computed, ref } from "vue";

import {
    CONFIGURACION_ALERTAS_POR_DEFECTO,
    calcularAlertas,
    fechasModificadasRecientes,
    leerConfiguracionAlertas
} from "../services/alertasService";

import type {
    AlertaDesarrollo,
    ConfiguracionAlertas,
    NivelAlerta
} from "../services/alertasService";

import { listarCargas } from "../services/auditoriaService";
import type { Carga } from "../services/auditoriaService";

import { useRequerimientosStore } from "./requerimientosStore";


/*
 * Alertas calculadas sobre los requerimientos ya cargados.
 * Lee la configuración y las últimas cargas (pocas
 * lecturas) una vez por sesión o al pulsar Actualizar.
 */
export const useAlertasStore = defineStore("alertas", () => {
    const requerimientosStore = useRequerimientosStore();
    const { requerimientos } = storeToRefs(requerimientosStore);

    const configuracion = ref<ConfiguracionAlertas>({ ...CONFIGURACION_ALERTAS_POR_DEFECTO });
    const cargas = ref<Carga[]>([]);
    const cargando = ref(false);
    const cargado = ref(false);
    const error = ref("");

    async function cargar(forzar = false) {
        if (cargando.value || (cargado.value && !forzar)) {
            return;
        }

        cargando.value = true;
        error.value = "";

        try {
            const [config, ultimas] = await Promise.all([
                leerConfiguracionAlertas(),
                listarCargas(30),
                requerimientosStore.cargar(forzar)
            ]);

            configuracion.value = config;
            cargas.value = ultimas;
            cargado.value = true;
        } catch (e) {
            console.error("Error cargando alertas:", e);
            error.value = e instanceof Error ? e.message : "No se pudieron calcular las alertas.";
        } finally {
            cargando.value = false;
        }
    }

    function limpiar() {
        cargas.value = [];
        cargado.value = false;
    }

    const alertas = computed<AlertaDesarrollo[]>(() =>
        calcularAlertas(
            requerimientos.value,
            configuracion.value,
            fechasModificadasRecientes(cargas.value, configuracion.value.diasFechaModificada)
        )
    );

    const porRequerimiento = computed(
        () => new Map(alertas.value.map(alerta => [alerta.idRequerimiento, alerta]))
    );

    const conteo = computed(() => {
        const resultado: Record<NivelAlerta | "MODIFICADA", number> = {
            VENCIDO: 0,
            VENCE_HOY: 0,
            PROXIMO: 0,
            MODIFICADA: 0
        };

        for (const alerta of alertas.value) {
            if (alerta.nivel) resultado[alerta.nivel] += 1;
            if (alerta.fechaModificada) resultado.MODIFICADA += 1;
        }

        return resultado;
    });

    /*
     * Lo que pide acción: vencidos, vencen hoy y próximos.
     */
    const pendientes = computed(
        () => alertas.value.filter(alerta => alerta.nivel !== null)
    );

    return {
        configuracion,
        cargas,
        cargando,
        cargado,
        error,
        alertas,
        porRequerimiento,
        conteo,
        pendientes,
        cargar,
        limpiar
    };
});
