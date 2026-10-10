<script setup lang="ts">
import {
  computed,
  onMounted
} from "vue";

import {
  storeToRefs
} from "pinia";

import {
  useRequerimientosStore
} from "../stores/requerimientosStore";

import BarList from "../components/dashboard/BarList.vue";
import AlertasResumen from "../components/alertas/AlertasResumen.vue";

import {
  useAlertasStore
} from "../stores/alertasStore";

import type {
  BarItem
} from "../components/dashboard/BarList.vue";

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
// INDICADORES
// =========================================================

function contar(
    filtro: (item: Requerimiento) => boolean
): number {
  return requerimientos.value.filter(filtro).length;
}


const indicadores =
    computed(() => [
      {
        titulo: "Total requerimientos",
        valor: requerimientos.value.length,
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
        requerimientos.value.filter(item => item.fuentes.includes("DT"))
    );

const enLS =
    computed(() =>
        requerimientos.value.filter(item => item.fuentes.includes("LS"))
    );


const COMBINACIONES: {
  etiqueta: string;
  fuentes: CodigoFuente[];
}[] = [
  { etiqueta: "DT + Listado + CQ", fuentes: ["DT", "LS", "CQ"] },
  { etiqueta: "DT + CQ", fuentes: ["DT", "CQ"] },
  { etiqueta: "DT + Listado", fuentes: ["DT", "LS"] },
  { etiqueta: "Solo DT", fuentes: ["DT"] },
  { etiqueta: "Listado + CQ", fuentes: ["LS", "CQ"] },
  { etiqueta: "Solo Listado", fuentes: ["LS"] },
  { etiqueta: "Solo CQ", fuentes: ["CQ"] }
];


const cobertura =
    computed<BarItem[]>(() =>
        COMBINACIONES.map(combinacion => ({
          etiqueta: combinacion.etiqueta,
          valor: contar(
              item => item.fuentes.join() === combinacion.fuentes.join()
          )
        }))
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
            requerimientos.value,
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

      for (const item of requerimientos.value) {
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

    <div class="page-intro">

      <div>
        <div class="eyebrow">
          <i class="pi pi-chart-bar" />
          Vista general
        </div>

        <h2>Dashboard</h2>

        <p>
          Indicadores de Demanda Táctica, Listado y ClearQuest.
          Haz clic en una barra para ver esos requerimientos.
        </p>
      </div>

      <button
          class="refresh-button"
          type="button"
          :disabled="cargando"
          @click="alertasStore.cargar(true)"
      >
        <i
            :class="
            cargando
              ? 'pi pi-spin pi-spinner'
              : 'pi pi-refresh'
          "
        />
        Actualizar
      </button>

    </div>


    <div
        v-if="error"
        class="error-box"
        role="alert"
    >
      <i class="pi pi-exclamation-triangle" />
      {{ error }}
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

    <div class="dashboard-grid">

      <BarList
          titulo="Cobertura entre fuentes"
          descripcion="En qué Excels aparece cada requerimiento."
          :items="cobertura"
          color="#16a34a"
      />

      <BarList
          titulo="Demanda Táctica por estado TI"
          descripcion="Requerimientos de DT según su Estado TI."
          :items="estadosDT"
          color="#2563eb"
          :limite="12"
      />

      <BarList
          titulo="Listado por estado"
          descripcion="Casos del Listado que todavía no están en DT."
          :items="estadosListado"
          color="#c2410c"
      />

      <BarList
          titulo="Actividades de ClearQuest por estado"
          descripcion="Cada actividad cuenta una vez."
          :items="actividadesCQ"
          color="#7c3aed"
      />

      <BarList
          titulo="Carga por responsable"
          descripcion="Requerimientos de DT y Listado por responsable o analista."
          :items="cargaResponsable"
          color="#2563eb"
      />

      <BarList
          titulo="Demanda Táctica por recurso"
          descripcion="Quién atiende cada requerimiento de DT."
          :items="porRecurso"
          color="#2563eb"
      />

      <BarList
          titulo="Requerimientos por gerencia"
          descripcion="Gerencia de DT o gerencia usuaria del Listado."
          :items="porGerencia"
          color="#2563eb"
      />

    </div>

  </section>
</template>


<style scoped>
.dashboard-page {
  width: 100%;
  padding-bottom: 32px;
}

.page-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: var(--pi-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.page-intro h2 {
  margin: 0;
  color: var(--pi-text);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.page-intro p {
  margin: 5px 0 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.refresh-button {
  display: inline-flex;
  align-items: center;
  min-height: 35px;
  padding: 0 12px;
  gap: 7px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.refresh-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border: 1px solid #fecaca;
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
      1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
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
  background: #eff6ff;
  color: #2563eb;
}

.metric-icon.cq {
  background: #f5f3ff;
  color: #7c3aed;
}

.metric-icon.ls {
  background: #fff7ed;
  color: #c2410c;
}

.metric-icon.warning {
  background: var(--pi-warning-soft);
  color: var(--pi-warning);
}

.metrica-card span {
  color: #64748b;
  font-size: 11px;
}

.metrica-card strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.metrica-card small {
  display: block;
  margin-top: 4px;
  color: #94a3b8;
  font-size: 10px;
}

.alertas {
  margin-bottom: 18px;
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

  .page-intro {
    flex-direction: column;
  }
}
</style>
