<script setup lang="ts">
import { ESTADOS_TEMPORALES } from "../../services/planificacionService";
import type { EstadoTemporal } from "../../models/Planificacion";


/*
 * Etiqueta del estado temporal (Vencido, Vence hoy...).
 */
defineProps<{
  estado: EstadoTemporal;
}>();
</script>


<template>
  <span class="estado-tag" :class="ESTADOS_TEMPORALES[estado].clase">
    <i :class="ESTADOS_TEMPORALES[estado].icono" />
    {{ ESTADOS_TEMPORALES[estado].nombre }}
  </span>
</template>


<style scoped>
.estado-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border: 1px solid var(--pt-border);
  border-radius: 999px;
  background: var(--pt-soft);
  color: var(--pt-color);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.estado-tag i {
  font-size: 10px;
}

.pt-finalizado,
.pt-sin,
.pt-info {
  color: var(--pi-text-subtle);
}
</style>
