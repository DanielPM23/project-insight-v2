<script setup lang="ts">
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface BarItem {
  etiqueta: string;
  valor: number;
  to?: RouteLocationRaw;
}

/*
 * Barras horizontales de una sola serie: la etiqueta a la
 * izquierda, el valor a la derecha y la barra proporcional
 * al máximo. Cada fila puede llevar a la lista filtrada.
 */
const props = withDefaults(
    defineProps<{
      titulo: string;
      descripcion?: string;
      items: BarItem[];
      color?: string;
      limite?: number;
    }>(),
    {
      descripcion: "",
      color: "var(--pi-primary)",
      limite: 10
    }
);

const visibles = computed(() => {
  const ordenados = props.items.filter(item => item.valor > 0);

  if (ordenados.length <= props.limite) {
    return ordenados;
  }

  const resto = ordenados
      .slice(props.limite - 1)
      .reduce((suma, item) => suma + item.valor, 0);

  return [
    ...ordenados.slice(0, props.limite - 1),
    { etiqueta: "Otros", valor: resto }
  ];
});

const maximo = computed(() =>
    Math.max(1, ...visibles.value.map(item => item.valor))
);

const total = computed(() =>
    props.items.reduce((suma, item) => suma + item.valor, 0)
);

function porcentaje(valor: number): string {
  return total.value
      ? `${Math.round((valor / total.value) * 100)}%`
      : "0%";
}
</script>


<template>
  <div class="panel">

    <div class="panel-heading">
      <h3>{{ titulo }}</h3>
      <p v-if="descripcion">{{ descripcion }}</p>
    </div>

    <p
        v-if="visibles.length === 0"
        class="empty"
    >
      Sin datos todavía.
    </p>

    <ul
        v-else
        class="bars"
    >
      <li
          v-for="item in visibles"
          :key="item.etiqueta"
      >
        <component
            :is="item.to ? 'RouterLink' : 'div'"
            :to="item.to"
            class="bar-row"
            :class="{ link: item.to }"
            :title="`${item.etiqueta}: ${item.valor} (${porcentaje(item.valor)})`"
        >
          <span class="bar-label">{{ item.etiqueta }}</span>

          <span class="bar-track">
            <span
                class="bar-fill"
                :style="{
                  width: `${(item.valor / maximo) * 100}%`,
                  background: color
                }"
            />
          </span>

          <span class="bar-value">{{ item.valor }}</span>
        </component>
      </li>
    </ul>

  </div>
</template>


<style scoped>
.panel {
  padding: 18px 20px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.panel-heading h3 {
  margin: 0;
  color: var(--pi-text);
  font-size: 13px;
  font-weight: 650;
}

.panel-heading p {
  margin: 3px 0 0;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.empty {
  margin: 24px 0 8px;
  color: var(--pi-text-muted);
  font-size: 11px;
  text-align: center;
}

.bars {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.bar-row {
  display: grid;
  grid-template-columns: minmax(90px, 38%) 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 5px 6px;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
}

.bar-row.link:hover {
  background: var(--pi-surface-soft);
}

.bar-label {
  overflow: hidden;
  color: var(--pi-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-track {
  height: 10px;
  border-radius: 4px;
  background: var(--pi-surface-muted);
}

.bar-fill {
  display: block;
  height: 100%;
  min-width: 3px;
  border-radius: 4px;
}

.bar-value {
  min-width: 30px;
  color: var(--pi-text);
  font-size: 11px;
  font-weight: 650;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
