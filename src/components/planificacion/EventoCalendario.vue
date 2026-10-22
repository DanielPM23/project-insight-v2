<script setup lang="ts">
import FuenteBadge from "./FuenteBadge.vue";

import { ESTADOS_TEMPORALES, TIPOS_EVENTO } from "../../services/planificacionService";
import type { PlanificacionEvento } from "../../models/Planificacion";


/*
 * Contenido de un evento del calendario: riesgo del
 * requerimiento, tipo de fecha, ID, responsable y fuente.
 */
defineProps<{
  evento: PlanificacionEvento;
  conNombre?: boolean;
}>();
</script>


<template>
  <div class="evento">
    <span class="fila">
      <i
          class="riesgo"
          :class="ESTADOS_TEMPORALES[evento.requerimiento.estadoTemporal].clase"
          :aria-label="ESTADOS_TEMPORALES[evento.requerimiento.estadoTemporal].nombre"
      />
      <i class="tipo" :class="TIPOS_EVENTO[evento.tipo].icono" :aria-label="TIPOS_EVENTO[evento.tipo].nombre" />
      <span class="codigo">{{ evento.requerimiento.codigo }}</span>
      <span class="corto">{{ TIPOS_EVENTO[evento.tipo].corto }}</span>
      <span class="responsable">{{ evento.requerimiento.responsable }}</span>
      <FuenteBadge :fuentes="evento.requerimiento.fuentes" compacto class="fuente" />
    </span>
    <span v-if="conNombre" class="nombre">{{ evento.requerimiento.nombre }}</span>
  </div>
</template>


<style scoped>
.evento {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 2px 5px;
  overflow: hidden;
  color: var(--pi-text);
}

.fila {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.riesgo {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pt-color);
}

.tipo {
  flex-shrink: 0;
  color: var(--pi-text-subtle);
  font-size: 8px;
}

.codigo {
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px;
  font-weight: 650;
}

.corto {
  flex-shrink: 0;
  color: var(--pi-text-subtle);
  font-size: 10px;
}

.responsable {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--pi-text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nombre {
  overflow: hidden;
  color: var(--pi-text-subtle);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* En celdas angostas queda el ID con su riesgo y tipo. */
@container (max-width: 150px) {
  .responsable,
  .fuente {
    display: none;
  }
}

@container (max-width: 115px) {
  .corto {
    display: none;
  }
}
</style>
