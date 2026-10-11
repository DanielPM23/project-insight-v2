<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import InputNumber from "primevue/inputnumber";
import MultiSelect from "primevue/multiselect";
import Button from "primevue/button";

import {
  esDesarrolloTerminadoPorDefecto,
  guardarConfiguracionAlertas,
  leerConfiguracionAlertas
} from "../services/alertasService";

import { useAlertasStore } from "../stores/alertasStore";
import { useAuthStore } from "../stores/authStore";
import { useRequerimientosStore } from "../stores/requerimientosStore";


const auth = useAuthStore();
const alertasStore = useAlertasStore();
const requerimientosStore = useRequerimientosStore();

const diasAnticipacion = ref(7);
const diasFechaModificada = ref(7);
const estadosTerminados = ref<string[]>([]);

const cargando = ref(true);
const guardando = ref(false);
const error = ref("");
const aviso = ref("");


/*
 * Estados TI que existen hoy en Demanda Táctica.
 */
const estadosDT = computed(() => {
  const estados = new Set<string>();

  for (const item of requerimientosStore.requerimientos) {
    if (item.demandaTactica?.estado) {
      estados.add(item.demandaTactica.estado);
    }
  }

  for (const estado of estadosTerminados.value) {
    estados.add(estado);
  }

  return Array.from(estados).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
});


onMounted(async () => {
  try {
    const [configuracion] = await Promise.all([
      leerConfiguracionAlertas(),
      requerimientosStore.cargar()
    ]);

    diasAnticipacion.value = configuracion.diasAnticipacion;
    diasFechaModificada.value = configuracion.diasFechaModificada;
    estadosTerminados.value =
        configuracion.estadosDesarrolloTerminado ??
        estadosDT.value.filter(esDesarrolloTerminadoPorDefecto);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "No se pudo leer la configuración.";
  } finally {
    cargando.value = false;
  }
});


async function guardar() {
  guardando.value = true;
  error.value = "";
  aviso.value = "";

  const configuracion = {
    diasAnticipacion: diasAnticipacion.value,
    diasFechaModificada: diasFechaModificada.value,
    estadosDesarrolloTerminado: [...estadosTerminados.value]
  };

  try {
    await guardarConfiguracionAlertas(configuracion, auth.usuario?.email ?? "");

    alertasStore.configuracion = configuracion;
    aviso.value = "Configuración guardada. Las alertas ya usan estos valores.";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "No se pudo guardar la configuración.";
  } finally {
    guardando.value = false;
  }
}
</script>


<template>
  <section class="configuracion-page">



    <div v-if="error" class="mensaje error" role="alert">
      <i class="pi pi-exclamation-triangle" />
      {{ error }}
    </div>

    <div v-if="aviso" class="mensaje ok">
      <i class="pi pi-check-circle" />
      {{ aviso }}
    </div>

    <form class="panel" @submit.prevent="guardar">
      <h3><i class="pi pi-bell" /> Alertas de desarrollo</h3>
      <p class="ayuda">
        Se calculan con la columna <strong>Fin Desarrollo</strong> de Demanda Táctica.
        Los requerimientos sin esa fecha no generan alertas.
      </p>

      <div class="campos">
        <label>
          <span>Días de anticipación para «Próximo a vencer»</span>
          <InputNumber
              v-model="diasAnticipacion"
              :min="1"
              :max="90"
              show-buttons
              suffix=" días"
              :disabled="cargando"
              size="small"
          />
          <small>Por ejemplo, con 7 días se avisa una semana antes de la fecha final.</small>
        </label>

        <label>
          <span>Días que se muestra «Fecha modificada recientemente»</span>
          <InputNumber
              v-model="diasFechaModificada"
              :min="1"
              :max="90"
              show-buttons
              suffix=" días"
              :disabled="cargando"
              size="small"
          />
          <small>Cuenta desde la carga que cambió la fecha final de desarrollo.</small>
        </label>
      </div>

      <label class="estados">
        <span>Estados TI en los que el desarrollo ya terminó</span>
        <MultiSelect
            v-model="estadosTerminados"
            :options="estadosDT"
            placeholder="Elige los estados"
            display="chip"
            filter
            :disabled="cargando"
            size="small"
            fluid
        />
        <small>
          En estos estados no se avisa de vencimiento. Tampoco cuando el requerimiento
          ya tiene «Fin Desarrollo Real».
        </small>
      </label>

      <div class="acciones">
        <Button
            type="submit"
            label="Guardar"
            icon="pi pi-check"
            size="small"
            :loading="guardando"
            :disabled="cargando"
        />
      </div>
    </form>

  </section>
</template>


<style scoped>
.configuracion-page {
  width: 100%;
  max-width: 900px;
  padding-bottom: 32px;
}

.mensaje {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border-radius: var(--pi-radius-md);
  font-size: 12px;
}

.mensaje.error { background: var(--pi-danger-soft); color: var(--pi-danger); }
.mensaje.ok { background: var(--pi-success-soft); color: var(--pi-success); }

.panel {
  padding: 20px 22px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--pi-text);
  font-size: 15px;
  font-weight: 650;
}

.ayuda {
  margin: 6px 0 18px;
  color: var(--pi-text-secondary);
  font-size: 12px;
}

.campos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label > span {
  color: var(--pi-text);
  font-size: 12px;
  font-weight: 600;
}

label small {
  color: var(--pi-text-muted);
  font-size: 11px;
}

.acciones {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

@media (max-width: 700px) {
  .campos {
    grid-template-columns: 1fr;
  }
}
</style>
