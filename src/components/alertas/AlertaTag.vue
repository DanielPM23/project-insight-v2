<script setup lang="ts">
import { computed } from "vue";
import Tag from "primevue/tag";

import {
  NIVELES_ALERTA,
  textoDias
} from "../../services/alertasService";

import type { AlertaDesarrollo } from "../../services/alertasService";
import { formatearFecha } from "../../utils/fechas";


/*
 * Indicador de la alerta de un requerimiento: nivel de
 * vencimiento y, si aplica, aviso de fecha modificada.
 */
const props = defineProps<{
  alerta: AlertaDesarrollo;
}>();

const detalle = computed(() => {
  const lineas = [
    `Fin de desarrollo: ${formatearFecha(props.alerta.fechaFin)}`,
    props.alerta.nivel ? textoDias(props.alerta.dias) : "Desarrollo terminado"
  ];

  const modificada = props.alerta.fechaModificada;

  if (modificada) {
    lineas.push(
        `Fecha modificada el ${formatearFecha(modificada.fechaCarga)}: ` +
        `${formatearFecha(modificada.anterior) || "sin fecha"} → ${formatearFecha(modificada.nuevo) || "sin fecha"}`
    );
  }

  return lineas.join("\n");
});
</script>


<template>
  <span class="alerta-tag">
    <Tag
        v-if="alerta.nivel"
        v-tooltip.top="detalle"
        :value="NIVELES_ALERTA[alerta.nivel].nombre"
        :icon="NIVELES_ALERTA[alerta.nivel].icono"
        :severity="NIVELES_ALERTA[alerta.nivel].severidad"
        class="tag"
    />
    <i
        v-if="alerta.fechaModificada"
        v-tooltip.top="detalle"
        class="pi pi-calendar-clock modificada"
        aria-label="Fecha de desarrollo modificada recientemente"
    />
  </span>
</template>


<style scoped>
.alerta-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.tag {
  font-size: 10px;
  white-space: nowrap;
}

.modificada {
  color: #7c3aed;
  font-size: 13px;
}
</style>
