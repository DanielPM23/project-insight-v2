<script setup lang="ts">
import { computed } from "vue";
import type { CodigoFuente } from "../../config/sourceSchemas";


/*
 * Fuentes del requerimiento en un solo badge neutro, para
 * que el color quede para el estado temporal. Compacto:
 * "DT+CQ"; normal: "DT + Listado + CQ".
 */
const props = defineProps<{
  fuentes: CodigoFuente[];
  compacto?: boolean;
}>();

const texto = computed(() =>
    props.compacto
        ? props.fuentes.join("+")
        : props.fuentes.map(fuente => (fuente === "LS" ? "Listado" : fuente)).join(" + ")
);
</script>


<template>
  <span v-if="fuentes.length" class="fuente-badge" :class="{ compacto }">{{ texto }}</span>
</template>


<style scoped>
.fuente-badge {
  display: inline-block;
  padding: 1px 6px;
  border: 1px solid var(--pi-border);
  border-radius: 4px;
  background: var(--pi-surface);
  color: var(--pi-text-subtle);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.fuente-badge.compacto {
  padding: 0 4px;
  font-size: 9px;
  line-height: 14px;
}
</style>
