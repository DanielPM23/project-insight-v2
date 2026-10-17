<script setup lang="ts">
import { computed, ref } from "vue";

export interface DonutItem {
  etiqueta: string;
  valor: number;
}

/*
 * Gráfico circular de una distribución: los primeros
 * valores con color propio y el resto en "Otros". La
 * leyenda muestra nombre, cantidad y porcentaje.
 */
const props = withDefaults(
    defineProps<{
      titulo: string;
      descripcion?: string;
      items: DonutItem[];
      unidad?: string;
      limite?: number;
    }>(),
    {
      descripcion: "",
      unidad: "proyectos",
      limite: 7
    }
);

/*
 * Colores categóricos en orden fijo; "Otros" va en gris.
 */
const COLORES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6"
];

const COLOR_OTROS = "#a8a29e";

const RADIO = 52;
const GROSOR = 22;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

const total = computed(() =>
    props.items.reduce((suma, item) => suma + item.valor, 0)
);

const segmentos = computed(() => {
  const ordenados = props.items
      .filter(item => item.valor > 0)
      .sort((a, b) => b.valor - a.valor);

  const visibles =
      ordenados.length <= props.limite
          ? ordenados
          : [
            ...ordenados.slice(0, props.limite - 1),
            {
              etiqueta: "Otros",
              valor: ordenados
                  .slice(props.limite - 1)
                  .reduce((suma, item) => suma + item.valor, 0)
            }
          ];

  let acumulado = 0;

  return visibles.map((item, indice) => {
    const fraccion = total.value ? item.valor / total.value : 0;
    const inicio = acumulado;
    acumulado += fraccion;

    // 2px de separación entre porciones cuando hay más de una.
    const separacion = visibles.length > 1 ? 2 : 0;
    const largo = Math.max(fraccion * CIRCUNFERENCIA - separacion, 0.5);

    return {
      ...item,
      color: item.etiqueta === "Otros" && indice === visibles.length - 1 && ordenados.length > props.limite
          ? COLOR_OTROS
          : COLORES[indice % COLORES.length],
      porcentaje: porcentaje(item.valor),
      dasharray: `${largo} ${CIRCUNFERENCIA - largo}`,
      dashoffset: -inicio * CIRCUNFERENCIA
    };
  });
});

const activo = ref<string | null>(null);

const destacado = computed(() =>
    segmentos.value.find(segmento => segmento.etiqueta === activo.value) ?? null
);

function porcentaje(valor: number): string {
  if (!total.value) {
    return "0%";
  }

  const valorPorcentaje = (valor / total.value) * 100;

  return valorPorcentaje < 10
      ? `${valorPorcentaje.toFixed(1)}%`
      : `${Math.round(valorPorcentaje)}%`;
}
</script>


<template>
  <div class="panel">

    <div class="panel-heading">
      <h3>{{ titulo }}</h3>
      <p v-if="descripcion">{{ descripcion }}</p>
    </div>

    <p
        v-if="segmentos.length === 0"
        class="empty"
    >
      Sin datos todavía.
    </p>

    <div
        v-else
        class="donut-body"
    >
      <svg
          class="donut"
          viewBox="0 0 140 140"
          role="img"
          :aria-label="`${titulo}: ${segmentos.map(s => `${s.etiqueta} ${s.valor} (${s.porcentaje})`).join(', ')}`"
      >
        <g transform="rotate(-90 70 70)">
          <circle
              v-for="segmento in segmentos"
              :key="segmento.etiqueta"
              cx="70"
              cy="70"
              :r="RADIO"
              fill="none"
              :stroke="segmento.color"
              :stroke-width="activo === segmento.etiqueta ? GROSOR + 4 : GROSOR"
              :stroke-dasharray="segmento.dasharray"
              :stroke-dashoffset="segmento.dashoffset"
              :opacity="activo && activo !== segmento.etiqueta ? 0.35 : 1"
              class="slice"
              @mouseenter="activo = segmento.etiqueta"
              @mouseleave="activo = null"
          >
            <title>{{ segmento.etiqueta }}: {{ segmento.valor }} {{ unidad }} ({{ segmento.porcentaje }})</title>
          </circle>
        </g>

        <text
            x="70"
            y="68"
            text-anchor="middle"
            class="center-value"
        >
          {{ destacado ? destacado.valor : total }}
        </text>
        <text
            x="70"
            y="84"
            text-anchor="middle"
            class="center-label"
        >
          {{ destacado ? destacado.porcentaje : unidad }}
        </text>
      </svg>

      <ul class="legend">
        <li
            v-for="segmento in segmentos"
            :key="segmento.etiqueta"
            :class="{ dim: activo && activo !== segmento.etiqueta }"
            @mouseenter="activo = segmento.etiqueta"
            @mouseleave="activo = null"
        >
          <span
              class="swatch"
              :style="{ background: segmento.color }"
          />
          <span
              class="legend-label"
              :title="segmento.etiqueta"
          >
            {{ segmento.etiqueta }}
          </span>
          <span class="legend-value">{{ segmento.valor }}</span>
          <span class="legend-pct">{{ segmento.porcentaje }}</span>
        </li>
      </ul>
    </div>

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

.donut-body {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
}

.donut {
  flex-shrink: 0;
  width: 140px;
  height: 140px;
}

.slice {
  cursor: pointer;
  transition: stroke-width 0.12s, opacity 0.12s;
}

.center-value,
.center-label {
  pointer-events: none;
}

.center-value {
  fill: var(--pi-text);
  font-size: 20px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.center-label {
  fill: var(--pi-text-muted);
  font-size: 9px;
}

.legend {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legend li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto 3.2rem;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
  border-radius: 6px;
  font-size: 11px;
  cursor: default;
}

.legend li:hover {
  background: var(--pi-surface-soft);
}

.legend li.dim {
  opacity: 0.5;
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-label {
  overflow: hidden;
  color: var(--pi-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-value {
  color: var(--pi-text);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.legend-pct {
  color: var(--pi-text-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
