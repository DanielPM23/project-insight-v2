<script setup lang="ts">
import {
  computed,
  onMounted,
  ref
} from "vue";

import {
  storeToRefs
} from "pinia";

import Button from "primevue/button";
import MultiSelect from "primevue/multiselect";

import {
  useRequerimientosStore
} from "../stores/requerimientosStore";

import BarList from "../components/dashboard/BarList.vue";
import DonutChart from "../components/dashboard/DonutChart.vue";
import AlertasResumen from "../components/alertas/AlertasResumen.vue";

import {
  useAlertasStore
} from "../stores/alertasStore";

import type {
  BarItem
} from "../components/dashboard/BarList.vue";

import type {
  DonutItem
} from "../components/dashboard/DonutChart.vue";

import type {
  RegistroFuente
} from "../services/registrosFuente";

import type {
  Requerimiento
} from "../services/requerimientosService";

import type {
  CodigoFuente
} from "../config/sourceSchemas";


const store =
    useRequerimientosStore();

const {
  requerimientos,
  cargando,
  error
} = storeToRefs(store);


const alertasStore =
    useAlertasStore();

onMounted(() => {
  store.cargar();
  alertasStore.cargar();
});


// =========================================================
// FILTROS
// =========================================================

/*
 * Filtros del dashboard: se aplican a todos los
 * indicadores y gráficos a la vez.
 */
type CampoFiltro =
    "anio" |
    "categoria" |
    "gerencia" |
    "tipoMatch";

const FILTROS: {
  campo: CampoFiltro;
  nombre: string;
}[] = [
  { campo: "anio", nombre: "Año" },
  { campo: "categoria", nombre: "Categoría" },
  { campo: "gerencia", nombre: "Gerencia" },
  { campo: "tipoMatch", nombre: "Tipo de Match" }
];

const filtros =
    ref<Record<CampoFiltro, string[]>>({
      anio: [],
      categoria: [],
      gerencia: [],
      tipoMatch: []
    });

const opcionesPorFiltro =
    computed(() =>
        Object.fromEntries(
            FILTROS.map(filtro => {
              const conteo =
                  new Map<string, number>();

              for (const item of requerimientos.value) {
                const valor =
                    item[filtro.campo];

                if (valor) {
                  conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
                }
              }

              const opciones =
                  Array.from(conteo)
                      .sort((a, b) =>
                          filtro.campo === "anio"
                              ? b[0].localeCompare(a[0], "es", { numeric: true })
                              : b[1] - a[1]
                      )
                      .map(([valor, cantidad]) => ({
                        valor,
                        etiqueta: `${valor} (${cantidad})`
                      }));

              return [filtro.campo, opciones];
            })
        ) as Record<CampoFiltro, { valor: string; etiqueta: string }[]>
    );

const cantidadFiltros =
    computed(() =>
        FILTROS.filter(filtro => filtros.value[filtro.campo].length > 0).length
    );

function limpiarFiltros() {
  for (const filtro of FILTROS) {
    filtros.value[filtro.campo] = [];
  }
}

const lista =
    computed(() =>
        requerimientos.value.filter(item =>
            FILTROS.every(filtro => {
              const valores =
                  filtros.value[filtro.campo];

              return valores.length === 0 || valores.includes(item[filtro.campo]);
            })
        )
    );


// =========================================================
// INDICADORES
// =========================================================

function contar(
    filtro: (item: Requerimiento) => boolean
): number {
  return lista.value.filter(filtro).length;
}


const indicadores =
    computed(() => [
      {
        titulo: "Total requerimientos",
        valor: lista.value.length,
        detalle: "Vista consolidada",
        icono: "pi pi-database",
        clase: ""
      },
      {
        titulo: "Demanda Táctica",
        valor: contar(item => item.fuentes.includes("DT")),
        detalle: "Requerimientos priorizados",
        icono: "pi pi-table",
        clase: "dt"
      },
      {
        titulo: "Listado",
        valor: contar(item => item.fuentes.includes("LS")),
        detalle: "Solicitudes en gestión",
        icono: "pi pi-list",
        clase: "ls"
      },
      {
        titulo: "ClearQuest",
        valor: contar(item => item.fuentes.includes("CQ")),
        detalle: "Con actividades en CQ",
        icono: "pi pi-server",
        clase: "cq"
      },
      {
        titulo: "Diferencias",
        valor: contar(item => item.alertas.length > 0),
        detalle: "Diferencias entre fuentes",
        icono: "pi pi-exclamation-triangle",
        clase: "warning"
      }
    ]);


// =========================================================
// AGRUPACIONES
// =========================================================

/*
 * Cuenta por un campo y arma las barras ordenadas de
 * mayor a menor, cada una enlazada a la lista filtrada.
 */
function agrupar(
    lista: Requerimiento[],
    campo: (item: Requerimiento) => string,
    filtro: string,
    fuentes?: CodigoFuente[]
): BarItem[] {
  const conteo =
      new Map<string, number>();

  for (const item of lista) {
    const valor =
        campo(item);

    if (valor) {
      conteo.set(
          valor,
          (conteo.get(valor) ?? 0) + 1
      );
    }
  }

  return Array.from(conteo, ([etiqueta, valor]) => ({
    etiqueta,
    valor,
    to: {
      name: "requerimientos",
      query: {
        [filtro]: etiqueta,
        ...(fuentes ? { fuentes: fuentes.join(",") } : {})
      }
    }
  })).sort((a, b) => b.valor - a.valor);
}


const enDT =
    computed(() =>
        lista.value.filter(item => item.fuentes.includes("DT"))
    );

const enLS =
    computed(() =>
        lista.value.filter(item => item.fuentes.includes("LS"))
    );


/*
 * Mismas etiquetas que Requerimiento.cobertura, en orden fijo.
 */
const COMBINACIONES = [
  "DT + Listado + CQ",
  "DT + CQ",
  "DT + Listado",
  "Solo DT",
  "Listado + CQ",
  "Solo Listado",
  "Solo CQ"
];


const cobertura =
    computed<BarItem[]>(() =>
        COMBINACIONES.map(etiqueta => ({
          etiqueta,
          valor: contar(item => item.cobertura === etiqueta),
          to: {
            name: "requerimientos",
            query: { cobertura: etiqueta }
          }
        }))
    );


const tiposMatch =
    computed(() =>
        agrupar(
            lista.value,
            item => item.tipoMatch,
            "tipoMatch"
        )
    );


/*
 * Proyectos por responsable en cada fuente: cada fila del
 * Excel cuenta una vez aunque aparezca en varios
 * requerimientos.
 */
function porResponsable(
    registrosDe: (item: Requerimiento) => (RegistroFuente | null)[],
    campo: string
): DonutItem[] {
  const vistos =
      new Set<string>();

  const conteo =
      new Map<string, number>();

  for (const item of lista.value) {
    for (const registro of registrosDe(item)) {
      if (!registro || vistos.has(registro.idDocumento)) {
        continue;
      }

      vistos.add(registro.idDocumento);

      const responsable =
          String(registro.datos[campo] ?? "").trim() || "Sin asignar";

      conteo.set(responsable, (conteo.get(responsable) ?? 0) + 1);
    }
  }

  return Array.from(conteo, ([etiqueta, valor]) => ({ etiqueta, valor }));
}


const responsablesDT =
    computed(() =>
        porResponsable(item => [item.demandaTactica], "responsable_dt")
    );

const responsablesLS =
    computed(() =>
        porResponsable(item => item.listado, "analista_bn")
    );

const responsablesCQ =
    computed(() =>
        porResponsable(item => item.clearQuest, "analista_cq")
    );


const estadosDT =
    computed(() =>
        agrupar(
            enDT.value,
            item => item.estado,
            "estado",
            ["DT"]
        ).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true }))
    );


const estadosListado =
    computed(() =>
        agrupar(
            enLS.value.filter(item => !item.fuentes.includes("DT")),
            item => item.estado,
            "estado",
            ["LS"]
        )
    );


const cargaResponsable =
    computed(() =>
        agrupar(
            [...enDT.value, ...enLS.value.filter(item => !item.fuentes.includes("DT"))],
            item => item.responsable,
            "responsable"
        )
    );


const porRecurso =
    computed(() =>
        agrupar(
            enDT.value,
            item => item.recurso,
            "recurso",
            ["DT"]
        )
    );


const porGerencia =
    computed(() =>
        agrupar(
            lista.value,
            item => item.gerencia,
            "gerencia"
        )
    );


/*
 * Estado de cada actividad de ClearQuest (no del
 * requerimiento): una actividad compartida por varios
 * requerimientos se cuenta una vez.
 */
const actividadesCQ =
    computed<BarItem[]>(() => {
      const vistas =
          new Set<string>();

      const conteo =
          new Map<string, number>();

      for (const item of lista.value) {
        for (const actividad of item.clearQuest) {
          if (vistas.has(actividad.idDocumento)) {
            continue;
          }

          vistas.add(actividad.idDocumento);

          const estado =
              actividad.estado || "Sin estado";

          conteo.set(
              estado,
              (conteo.get(estado) ?? 0) + 1
          );
        }
      }

      return Array.from(conteo, ([etiqueta, valor]) => ({ etiqueta, valor }))
          .sort((a, b) => b.valor - a.valor);
    });
</script>


<template>
  <section class="dashboard-page">

    <Teleport defer to="#topbar-acciones">
      <Button
          label="Actualizar"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="cargando"
          @click="alertasStore.cargar(true)"
      />
    </Teleport>


    <div
        v-if="error"
        class="error-box"
        role="alert"
    >
      <i class="pi pi-exclamation-triangle" />
      {{ error }}
    </div>


    <div class="filters-row">
      <MultiSelect
          v-for="filtro in FILTROS"
          :key="filtro.campo"
          v-model="filtros[filtro.campo]"
          :options="opcionesPorFiltro[filtro.campo]"
          option-label="etiqueta"
          option-value="valor"
          :placeholder="filtro.nombre"
          :selected-items-label="`${filtro.nombre} ({0})`"
          :max-selected-labels="1"
          filter
          show-clear
          size="small"
          class="filter-select"
          :class="{ active: filtros[filtro.campo].length > 0 }"
          :aria-label="`Filtrar el dashboard por ${filtro.nombre.toLowerCase()}`"
      />

      <Button
          :label="cantidadFiltros > 0 ? `Limpiar filtros (${cantidadFiltros})` : 'Limpiar filtros'"
          icon="pi pi-filter-slash"
          severity="secondary"
          text
          size="small"
          :disabled="cantidadFiltros === 0"
          @click="limpiarFiltros"
      />
    </div>

    <div class="grid-metricas">
      <div
          v-for="indicador in indicadores"
          :key="indicador.titulo"
          class="metrica-card"
      >
        <div
            class="metric-icon"
            :class="indicador.clase"
        >
          <i :class="indicador.icono" />
        </div>
        <div>
          <span>{{ indicador.titulo }}</span>
          <strong>{{ cargando && !requerimientos.length ? "…" : indicador.valor }}</strong>
          <small>{{ indicador.detalle }}</small>
        </div>
      </div>
    </div>


    <AlertasResumen class="alertas" />

    <div class="grid-responsables">
      <DonutChart
          titulo="ClearQuest por responsable"
          descripcion="Registros de ClearQuest por responsable."
          :items="responsablesCQ"
      />

      <DonutChart
          titulo="Demanda Táctica por responsable"
          descripcion="Filas de DT por responsable."
          :items="responsablesDT"
      />

      <DonutChart
          titulo="Listado por analista"
          descripcion="Casos del Listado por Analista BN."
          unidad="casos"
          :items="responsablesLS"
      />
    </div>

    <div class="dashboard-grid">

      <BarList
          titulo="Cobertura entre fuentes"
          descripcion="En qué Excels aparece cada requerimiento."
          :items="cobertura"
          color="var(--pi-success)"
      />

      <BarList
          titulo="Tipo de match"
          descripcion="Cómo se cruzaron las fuentes: por ID Mantenimiento, por ID Trámite o sin match."
          :items="tiposMatch"
          color="var(--pi-success)"
      />

      <BarList
          titulo="Demanda Táctica por estado TI"
          descripcion="Requerimientos de DT según su Estado TI."
          :items="estadosDT"
          color="var(--pi-primary)"
          :limite="12"
      />

      <BarList
          titulo="Listado por estado"
          descripcion="Casos del Listado que todavía no están en DT."
          :items="estadosListado"
          color="var(--pi-orange)"
      />

      <BarList
          titulo="Actividades de ClearQuest por estado"
          descripcion="Cada actividad cuenta una vez."
          :items="actividadesCQ"
          color="var(--pi-purple)"
      />

      <BarList
          titulo="Carga por responsable"
          descripcion="Requerimientos de DT y Listado por responsable o analista."
          :items="cargaResponsable"
          color="var(--pi-primary)"
      />

      <BarList
          titulo="Demanda Táctica por recurso"
          descripcion="Quién atiende cada requerimiento de DT."
          :items="porRecurso"
          color="var(--pi-primary)"
      />

      <BarList
          titulo="Requerimientos por gerencia"
          descripcion="Gerencia de DT o gerencia usuaria del Listado."
          :items="porGerencia"
          color="var(--pi-primary)"
      />

    </div>

  </section>
</template>


<style scoped>
.dashboard-page {
  width: 100%;
  padding-bottom: 32px;
}

.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border: 1px solid var(--pi-danger-border);
  border-radius: var(--pi-radius-md);
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
  font-size: 11px;
}

.grid-metricas {
  display: grid;
  grid-template-columns:
    repeat(
      5,
      minmax(0, 1fr)
    );
  gap: 14px;
  margin-bottom: 18px;
}

.metrica-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border:
      1px solid var(--pi-border);
  border-radius: 12px;
  background: var(--pi-surface);
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--pi-surface-muted);
  color: var(--pi-text-secondary);
}

.metric-icon.dt {
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
}

.metric-icon.cq {
  background: var(--pi-purple-soft);
  color: var(--pi-purple);
}

.metric-icon.ls {
  background: var(--pi-orange-soft);
  color: var(--pi-orange);
}

.metric-icon.warning {
  background: var(--pi-warning-soft);
  color: var(--pi-warning);
}

.metrica-card span {
  color: var(--pi-text-subtle);
  font-size: 11px;
}

.metrica-card strong {
  display: block;
  margin-top: 4px;
  color: var(--pi-text);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.metrica-card small {
  display: block;
  margin-top: 4px;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.alertas {
  margin-bottom: 18px;
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
}

.filter-select {
  width: 170px;
}

.filter-select.active {
  border-color: var(--pi-primary);
  background: var(--pi-primary-soft);
}

.grid-responsables {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 18px;
}

@media (max-width: 1250px) {
  .grid-responsables {
    grid-template-columns: 1fr;
  }
}

.dashboard-grid {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 18px;
}

@media (
max-width: 1100px
) {
  .grid-metricas {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }
}

@media (
max-width: 1000px
) {
  .dashboard-grid {
    grid-template-columns:
      1fr;
  }
}

@media (
max-width: 600px
) {
  .grid-metricas {
    grid-template-columns:
      1fr;
  }
}
</style>
