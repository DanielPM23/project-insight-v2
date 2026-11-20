import { defineStore } from "pinia";
import { computed, markRaw, ref, shallowRef } from "vue";
import { obtenerRequerimientos } from "../services/requerimientosService";
import type { Requerimiento } from "../services/requerimientosService";

/*
 * Cache compartido entre Dashboard, Requerimientos y el
 * detalle: se lee Firestore una vez y se consolida en el
 * navegador. "Actualizar" vuelve a leer.
 */
export const useRequerimientosStore = defineStore("requerimientos", () => {
    /*
     * shallowRef + markRaw: la lista se reemplaza entera al
     * cargar y nadie modifica sus elementos. Con ref, Vue
     * envolvía en proxies cada requerimiento y cada fila de
     * las fuentes (60+ campos), y cada filtro, gráfico o
     * tabla pagaba ese costo al recorrerlos.
     */
    const requerimientos = shallowRef<Requerimiento[]>(markRaw([]));
    const cargando = ref(false);
    const cargado = ref(false);
    const error = ref("");

    const porId = computed(
        () => new Map(requerimientos.value.map(item => [item.id, item]))
    );

    /*
     * Requerimiento al que pertenece cada fila de las
     * fuentes (DT_3558 → DT:3558), para enlazar desde la
     * auditoría.
     */
    const porDocumento = computed(() => {
        const mapa = new Map<string, Requerimiento>();

        for (const item of requerimientos.value) {
            const registros = [
                item.demandaTactica,
                ...item.listado,
                ...item.clearQuest
            ];

            for (const registro of registros) {
                if (registro && !mapa.has(registro.idDocumento)) {
                    mapa.set(registro.idDocumento, item);
                }
            }
        }

        return mapa;
    });

    async function cargar(forzar = false) {
        if (cargando.value || (cargado.value && !forzar)) {
            return;
        }

        cargando.value = true;
        error.value = "";

        try {
            requerimientos.value = markRaw(await obtenerRequerimientos());
            cargado.value = true;
        } catch (e) {
            console.error("Error cargando requerimientos:", e);

            error.value =
                e instanceof Error
                    ? e.message
                    : "No se pudieron cargar los requerimientos.";
        } finally {
            cargando.value = false;
        }
    }

    /*
     * Al cambiar de usuario no se reutilizan los datos
     * leídos con la sesión anterior.
     */
    function limpiar() {
        requerimientos.value = markRaw([]);
        cargado.value = false;
        error.value = "";
    }

    return {
        requerimientos,
        cargando,
        cargado,
        error,
        porId,
        porDocumento,
        cargar,
        limpiar
    };
});
