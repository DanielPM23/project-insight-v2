<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch
} from "vue";

import {
  useRoute,
  useRouter
} from "vue-router";

import {
  storeToRefs
} from "pinia";

import {
  useRequerimientosStore
} from "../stores/requerimientosStore";

import type {
  Requerimiento
} from "../services/requerimientosService";

import type {
  CodigoFuente
} from "../config/sourceSchemas";


// =========================================================
// ESTADO
// =========================================================

const router =
    useRouter();

const route =
    useRoute();

const store =
    useRequerimientosStore();

const {
  requerimientos,
  cargando,
  error
} = storeToRefs(store);


const FUENTES_FILTRO: {
  codigo: CodigoFuente;
  nombre: string;
}[] = [
  { codigo: "DT", nombre: "Demanda Táctica" },
  { codigo: "CQ", nombre: "ClearQuest" },
  { codigo: "LS", nombre: "Listado" }
];


const TAMANO_PAGINA =
    50;


const busqueda =
    ref("");

/*
 * Se muestran los requerimientos presentes en
 * al menos una de las fuentes seleccionadas.
 */
const fuentesSeleccionadas =
    ref<CodigoFuente[]>(
        FUENTES_FILTRO.map(
            fuente =>
                fuente.codigo
        )
    );

const filtroEstado =
    ref("");

const filtroResponsable =
    ref("");

const filtroGerencia =
    ref("");

const filtroAplicacion =
    ref("");

const filtroAnio =
    ref("");

const soloAlertas =
    ref(false);

const pagina =
    ref(1);


/*
 * El dashboard enlaza aquí con filtros en la URL
 * (?estado=...&fuentes=DT,LS).
 */
function aplicarFiltrosDeUrl() {
  const valor = (
      clave: string
  ): string => {
    const dato =
        route.query[clave];

    return typeof dato === "string"
        ? dato
        : "";
  };

  filtroEstado.value = valor("estado");
  filtroResponsable.value = valor("responsable");
  filtroGerencia.value = valor("gerencia");
  filtroAplicacion.value = valor("aplicacion");
  filtroAnio.value = valor("anio");

  const fuentes =
      valor("fuentes")
          .split(",")
          .filter((codigo): codigo is CodigoFuente =>
              FUENTES_FILTRO.some(fuente => fuente.codigo === codigo)
          );

  if (fuentes.length > 0) {
    fuentesSeleccionadas.value = fuentes;
  }
}


onMounted(() => {
  aplicarFiltrosDeUrl();
  store.cargar();
});


// =========================================================
// MÉTRICAS
// =========================================================

function totalFuente(
    codigo: CodigoFuente
): number {
  return requerimientos.value
      .filter(
          item =>
              item.fuentes.includes(codigo)
      )
      .length;
}


const total =
    computed(() => requerimientos.value.length);

const totalDT =
    computed(() => totalFuente("DT"));

const totalCQ =
    computed(() => totalFuente("CQ"));

const totalLS =
    computed(() => totalFuente("LS"));

const totalTres =
    computed(
        () =>
            requerimientos.value
                .filter(
                    item =>
                        item.fuentes.length === 3
                )
                .length
    );


// =========================================================
// OPCIONES DE FILTRO
// =========================================================

interface OpcionFiltro {
  valor: string;
  cantidad: number;
}


/*
 * Valores distintos de un campo, con cuántos
 * requerimientos tienen cada uno.
 */
function opciones(
    campo: (item: Requerimiento) => string,
    orden: "cantidad" | "valor" = "cantidad"
): OpcionFiltro[] {
  const conteo =
      new Map<string, number>();

  for (const item of requerimientos.value) {
    const valor =
        campo(item);

    if (valor) {
      conteo.set(
          valor,
          (conteo.get(valor) ?? 0) + 1
      );
    }
  }

  return Array.from(
      conteo,
      ([valor, cantidad]) => ({ valor, cantidad })
  ).sort((a, b) =>
      orden === "cantidad"
          ? b.cantidad - a.cantidad
          : b.valor.localeCompare(a.valor, "es", { numeric: true })
  );
}


const opcionesEstado =
    computed(() => opciones(item => item.estado));

const opcionesResponsable =
    computed(() => opciones(item => item.responsable));

const opcionesGerencia =
    computed(() => opciones(item => item.gerencia));

const opcionesAplicacion =
    computed(() => opciones(item => item.aplicacion));

const opcionesAnio =
    computed(() => opciones(item => item.anio, "valor"));


// =========================================================
// FILTROS
// =========================================================

function alternarFuente(
    codigo: CodigoFuente
) {
  const seleccion =
      fuentesSeleccionadas.value;

  fuentesSeleccionadas.value =
      seleccion.includes(codigo)
          ? seleccion.filter(item => item !== codigo)
          : [...seleccion, codigo];
}


const hayFiltros =
    computed(() =>
        !!busqueda.value ||
        fuentesSeleccionadas.value.length !== FUENTES_FILTRO.length ||
        !!filtroEstado.value ||
        !!filtroResponsable.value ||
        !!filtroGerencia.value ||
        !!filtroAplicacion.value ||
        !!filtroAnio.value ||
        soloAlertas.value
    );


function limpiarFiltros() {
  busqueda.value = "";
  fuentesSeleccionadas.value =
      FUENTES_FILTRO.map(fuente => fuente.codigo);
  filtroEstado.value = "";
  filtroResponsable.value = "";
  filtroGerencia.value = "";
  filtroAplicacion.value = "";
  filtroAnio.value = "";
  soloAlertas.value = false;
}


const requerimientosFiltrados =
    computed(() => {
      const termino =
          busqueda.value
              .trim()
              .toLowerCase();

      const seleccion =
          fuentesSeleccionadas.value;

      return requerimientos.value
          .filter(item => {
            if (
                !item.fuentes.some(
                    fuente =>
                        seleccion.includes(fuente)
                )
            ) {
              return false;
            }

            if (
                (filtroEstado.value && item.estado !== filtroEstado.value) ||
                (filtroResponsable.value && item.responsable !== filtroResponsable.value) ||
                (filtroGerencia.value && item.gerencia !== filtroGerencia.value) ||
                (filtroAplicacion.value && item.aplicacion !== filtroAplicacion.value) ||
                (filtroAnio.value && item.anio !== filtroAnio.value) ||
                (soloAlertas.value && item.alertas.length === 0)
            ) {
              return false;
            }

            if (!termino) {
              return true;
            }

            const contenido =
                [
                  item.idMantenimiento,
                  item.idTramite,
                  item.idDemanda,
                  item.caso,
                  item.nombre,
                  item.estado,
                  item.responsable,
                  item.aplicacion,
                  item.gerencia
                ]
                    .join(" ")
                    .toLowerCase();

            return contenido.includes(
                termino
            );
          });
    });


// =========================================================
// PAGINACIÓN
// =========================================================

const totalPaginas =
    computed(() =>
        Math.max(
            1,
            Math.ceil(requerimientosFiltrados.value.length / TAMANO_PAGINA)
        )
    );

const requerimientosPagina =
    computed(() =>
        requerimientosFiltrados.value.slice(
            (pagina.value - 1) * TAMANO_PAGINA,
            pagina.value * TAMANO_PAGINA
        )
    );

watch(
    requerimientosFiltrados,
    () => {
      pagina.value = 1;
    }
);


// =========================================================
// HELPERS
// =========================================================

function claseFuente(
    fuente: CodigoFuente
): string {
  return `source-${fuente.toLowerCase()}`;
}


function abrirDetalle(
    item: Requerimiento
) {
  router.push({
    name: "requerimiento-detalle",
    params: {
      id: item.id
    }
  });
}
</script>


<template>
  <section class="requirements-page">

    <div class="page-intro">

      <div>
        <div class="eyebrow">
          <i class="pi pi-list" />
          Gestión de requerimientos
        </div>

        <h2>
          Requerimientos
        </h2>

        <p>
          Vista consolidada de Demanda Táctica, ClearQuest y Listado.
          Selecciona un requerimiento para ver todos sus campos.
        </p>
      </div>

      <button
          class="refresh-button"
          type="button"
          :disabled="cargando"
          @click="store.cargar(true)"
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


    <div class="metrics-grid">

      <div class="metric-card">
        <div class="metric-icon">
          <i class="pi pi-database" />
        </div>
        <div>
          <span>Total</span>
          <strong>{{ total }}</strong>
          <small>Requerimientos consolidados</small>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon dt">
          <i class="pi pi-table" />
        </div>
        <div>
          <span>Demanda Táctica</span>
          <strong>{{ totalDT }}</strong>
          <small>Presentes en DT</small>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon cq">
          <i class="pi pi-server" />
        </div>
        <div>
          <span>ClearQuest</span>
          <strong>{{ totalCQ }}</strong>
          <small>Con actividades en CQ</small>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon ls">
          <i class="pi pi-list" />
        </div>
        <div>
          <span>Listado</span>
          <strong>{{ totalLS }}</strong>
          <small>Presentes en Listado</small>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon both">
          <i class="pi pi-link" />
        </div>
        <div>
          <span>En las 3 fuentes</span>
          <strong>{{ totalTres }}</strong>
          <small>DT + Listado + ClearQuest</small>
        </div>
      </div>

    </div>


    <div class="table-card">

      <div class="table-toolbar">

        <div class="search-box">
          <i class="pi pi-search" />
          <input
              v-model="busqueda"
              type="search"
              placeholder="Buscar por mantenimiento, trámite, caso, nombre, responsable..."
          />
        </div>

        <div
            class="source-filter"
            role="group"
            aria-label="Filtrar por fuente"
        >
          <button
              v-for="fuente in FUENTES_FILTRO"
              :key="fuente.codigo"
              type="button"
              class="source-chip"
              :class="[
                claseFuente(fuente.codigo),
                {
                  inactive:
                    !fuentesSeleccionadas.includes(fuente.codigo)
                }
              ]"
              :aria-pressed="fuentesSeleccionadas.includes(fuente.codigo)"
              @click="alternarFuente(fuente.codigo)"
          >
            {{ fuente.nombre }}
          </button>
        </div>

        <div class="results-count">
          <strong>
            {{ requerimientosFiltrados.length }}
          </strong>
          <span>
            resultados
          </span>
        </div>

      </div>


      <div class="filters-row">

        <select
            v-model="filtroEstado"
            class="filter-select"
            :class="{ active: filtroEstado }"
            aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option
              v-for="opcion in opcionesEstado"
              :key="opcion.valor"
              :value="opcion.valor"
          >
            {{ opcion.valor }} ({{ opcion.cantidad }})
          </option>
        </select>

        <select
            v-model="filtroResponsable"
            class="filter-select"
            :class="{ active: filtroResponsable }"
            aria-label="Responsable"
        >
          <option value="">Todos los responsables</option>
          <option
              v-for="opcion in opcionesResponsable"
              :key="opcion.valor"
              :value="opcion.valor"
          >
            {{ opcion.valor }} ({{ opcion.cantidad }})
          </option>
        </select>

        <select
            v-model="filtroGerencia"
            class="filter-select"
            :class="{ active: filtroGerencia }"
            aria-label="Gerencia"
        >
          <option value="">Todas las gerencias</option>
          <option
              v-for="opcion in opcionesGerencia"
              :key="opcion.valor"
              :value="opcion.valor"
          >
            {{ opcion.valor }} ({{ opcion.cantidad }})
          </option>
        </select>

        <select
            v-model="filtroAplicacion"
            class="filter-select"
            :class="{ active: filtroAplicacion }"
            aria-label="Aplicación"
        >
          <option value="">Todas las aplicaciones</option>
          <option
              v-for="opcion in opcionesAplicacion"
              :key="opcion.valor"
              :value="opcion.valor"
          >
            {{ opcion.valor }} ({{ opcion.cantidad }})
          </option>
        </select>

        <select
            v-model="filtroAnio"
            class="filter-select"
            :class="{ active: filtroAnio }"
            aria-label="Año"
        >
          <option value="">Todos los años</option>
          <option
              v-for="opcion in opcionesAnio"
              :key="opcion.valor"
              :value="opcion.valor"
          >
            {{ opcion.valor }} ({{ opcion.cantidad }})
          </option>
        </select>

        <label class="filter-check">
          <input
              v-model="soloAlertas"
              type="checkbox"
          />
          Solo con alertas
        </label>

        <button
            v-if="hayFiltros"
            type="button"
            class="clear-button"
            @click="limpiarFiltros"
        >
          <i class="pi pi-filter-slash" />
          Limpiar filtros
        </button>

      </div>


      <div
          v-if="cargando"
          class="state-container"
      >
        <div class="state-icon loading">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <strong>
          Cargando Project Insight...
        </strong>
        <span>
          Consultando los registros en Firestore.
        </span>
      </div>

      <div
          v-else-if="error"
          class="state-container"
      >
        <div class="state-icon error">
          <i class="pi pi-exclamation-triangle" />
        </div>
        <strong>
          No se pudo cargar la información
        </strong>
        <span>
          {{ error }}
        </span>
      </div>

      <div
          v-else-if="requerimientos.length === 0"
          class="state-container"
      >
        <div class="state-icon">
          <i class="pi pi-upload" />
        </div>
        <strong>
          Todavía no hay registros cargados
        </strong>
        <span>
          Carga los Excels de Demanda Táctica, ClearQuest y Listado
          desde Importaciones.
        </span>
      </div>

      <div
          v-else-if="requerimientosFiltrados.length === 0"
          class="state-container"
      >
        <div class="state-icon">
          <i class="pi pi-search" />
        </div>
        <strong>
          No se encontraron requerimientos
        </strong>
        <span>
          Prueba con otro término de búsqueda
          o cambia los filtros.
        </span>
      </div>

      <template v-else>

        <div class="table-wrapper">

          <table>

            <thead>
            <tr>
              <th>ID Mantenimiento</th>
              <th>ID Trámite</th>
              <th>ID Demanda / Caso</th>
              <th class="requirement-column">
                Requerimiento
              </th>
              <th>Fuentes</th>
              <th>Estado</th>
              <th>Responsable / Analista</th>
              <th>Aplicación</th>
            </tr>
            </thead>

            <tbody>

            <tr
                v-for="item in requerimientosPagina"
                :key="item.id"
                class="clickable-row"
                tabindex="0"
                @click="abrirDetalle(item)"
                @keydown.enter="abrirDetalle(item)"
            >

              <td>
                <span
                    v-if="item.idMantenimiento"
                    class="id-value"
                >
                  {{ item.idMantenimiento }}
                </span>
                <span
                    v-else
                    class="empty-value"
                >
                  —
                </span>
              </td>

              <td>
                <span
                    v-if="item.idTramite"
                    class="id-secondary"
                >
                  {{ item.idTramite }}
                </span>
                <span
                    v-else
                    class="empty-value"
                >
                  —
                </span>
              </td>

              <td>
                <span
                    v-if="item.idDemanda || item.caso"
                    class="id-secondary"
                >
                  {{ item.idDemanda || item.caso }}
                </span>
                <span
                    v-else
                    class="empty-value"
                >
                  —
                </span>
              </td>

              <td class="requirement-cell">
                <strong :title="item.nombre">
                  {{ item.nombre || "Sin nombre" }}
                  <i
                      v-if="item.alertas.length > 0"
                      class="pi pi-exclamation-triangle alert-icon"
                      :title="item.alertas.join('\n')"
                  />
                </strong>
                <small v-if="item.compartenMantenimiento > 0">
                  Comparte mantenimiento con
                  {{ item.compartenMantenimiento }}
                  requerimiento(s) más
                </small>
                <small v-else-if="item.gerencia">
                  {{ item.gerencia }}
                </small>
              </td>

              <td>
                <span class="source-list">
                  <span
                      v-for="fuente in item.fuentes"
                      :key="fuente"
                      class="source-badge"
                      :class="claseFuente(fuente)"
                  >
                    {{ fuente }}
                  </span>
                </span>
              </td>

              <td>
                <span
                    v-if="item.estado"
                    class="status-badge"
                >
                  {{ item.estado }}
                </span>
                <span
                    v-else
                    class="empty-value"
                >
                  —
                </span>
              </td>

              <td>
                {{ item.responsable || "—" }}
              </td>

              <td>
                {{ item.aplicacion || "—" }}
              </td>

            </tr>

            </tbody>

          </table>

        </div>


        <div class="pagination">

          <span>
            Página {{ pagina }} de {{ totalPaginas }}
          </span>

          <button
              type="button"
              :disabled="pagina <= 1"
              @click="pagina--"
          >
            Anterior
          </button>

          <button
              type="button"
              :disabled="pagina >= totalPaginas"
              @click="pagina++"
          >
            Siguiente
          </button>

        </div>

      </template>

    </div>

  </section>
</template>


<style scoped>

.requirements-page {
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


.refresh-button,
.clear-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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


.refresh-button:hover:not(:disabled),
.clear-button:hover {
  background: var(--pi-surface-soft);
}


.refresh-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}


.metrics-grid {
  display: grid;
  grid-template-columns:
    repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}


.metric-card {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 15px;
  gap: 11px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
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

.metric-icon.both {
  background: #ecfdf5;
  color: #16a34a;
}


.metric-icon i {
  font-size: 13px;
}


.metric-card span {
  display: block;
  color: var(--pi-text-muted);
  font-size: 9px;
  font-weight: 600;
}


.metric-card strong {
  display: block;
  margin-top: 3px;
  color: var(--pi-text);
  font-size: 20px;
  font-weight: 700;
}


.metric-card small {
  display: block;
  margin-top: 2px;
  color: var(--pi-text-muted);
  font-size: 8px;
}


.table-card {
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}


.table-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--pi-border);
}


.search-box {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 260px;
  max-width: 600px;
  height: 36px;
  padding: 0 11px;
  gap: 8px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface-soft);
}


.search-box:focus-within {
  border-color: #93c5fd;
  background: #ffffff;
  box-shadow:
      0 0 0 3px
      rgba(37, 99, 235, 0.07);
}


.search-box i {
  color: var(--pi-text-muted);
  font-size: 11px;
}


.search-box input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--pi-text-secondary);
  font-size: 10px;
}


.source-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-chip {
  height: 30px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
}

.source-chip.inactive {
  border-color: var(--pi-border);
  background: var(--pi-surface);
  color: var(--pi-text-muted);
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--pi-border);
  background: var(--pi-surface-soft);
}

.filter-select {
  height: 32px;
  min-width: 150px;
  max-width: 220px;
  padding: 0 8px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
  font-size: 10px;
  outline: none;
}

.filter-select.active {
  border-color: #93c5fd;
  color: var(--pi-primary);
}

.filter-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pi-text-secondary);
  font-size: 10px;
  cursor: pointer;
}

.source-list {
  display: inline-flex;
  gap: 4px;
}

.clickable-row {
  cursor: pointer;
}

.alert-icon {
  margin-left: 4px;
  color: var(--pi-warning);
  font-size: 9px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  color: var(--pi-text-muted);
  font-size: 9px;
}

.pagination button {
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
  font-size: 10px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


.results-count {
  display: flex;
  align-items: baseline;
  margin-left: auto;
  gap: 4px;
  white-space: nowrap;
}


.results-count strong {
  color: var(--pi-text);
  font-size: 11px;
}


.results-count span {
  color: var(--pi-text-muted);
  font-size: 9px;
}


.table-wrapper {
  width: 100%;
  max-height: calc(100vh - 330px);
  overflow: auto;
}


table {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
}


th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 10px 12px;
  border-bottom: 1px solid var(--pi-border);
  background: var(--pi-surface-soft);
  color: var(--pi-text-muted);
  text-align: left;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  white-space: nowrap;
}


td {
  padding: 10px 12px;
  border-bottom: 1px solid #edf2f7;
  color: var(--pi-text-secondary);
  font-size: 9px;
  vertical-align: middle;
}


tbody tr {
  transition:
      background
      var(--pi-transition);
}


tbody tr:hover {
  background: #fafcff;
}


.requirement-column {
  min-width: 270px;
}


.requirement-cell {
  max-width: 360px;
}


.requirement-cell strong {
  display: block;
  overflow: hidden;
  color: var(--pi-text);
  font-size: 9px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.requirement-cell small {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--pi-text-muted);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.id-value {
  color: var(--pi-primary);
  font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  font-size: 8px;
  font-weight: 700;
  white-space: nowrap;
}


.id-secondary {
  color: var(--pi-text-secondary);
  font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  font-size: 8px;
  white-space: nowrap;
}


.empty-value {
  color: #cbd5e1;
}


.source-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 7px;
  border-radius: 999px;
  font-size: 8px;
  font-weight: 650;
  white-space: nowrap;
}


.source-dt {
  background: #eff6ff;
  color: #2563eb;
}


.source-cq {
  background: #f5f3ff;
  color: #7c3aed;
}


.source-ls {
  background: #fff7ed;
  color: #c2410c;
}


.status-badge {
  background: var(--pi-surface-muted);
  color: var(--pi-text-secondary);
}

.state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: 320px;
  padding: 32px;
  text-align: center;
}


.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  margin-bottom: 10px;
  border-radius: 50%;
  background: var(--pi-surface-muted);
  color: var(--pi-text-muted);
}


.state-icon.loading {
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
}


.state-icon.error {
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
}


.state-container strong {
  color: var(--pi-text);
  font-size: 11px;
}


.state-container span {
  max-width: 420px;
  margin-top: 4px;
  color: var(--pi-text-muted);
  font-size: 9px;
}


@media (max-width: 1050px) {

  .metrics-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }


  .table-toolbar {
    flex-wrap: wrap;
  }


  .results-count {
    margin-left: 0;
  }

}


@media (max-width: 650px) {

  .page-intro {
    flex-direction: column;
  }


  .metrics-grid {
    grid-template-columns: 1fr;
  }


  .search-box {
    min-width: 100%;
    max-width: none;
  }


  .filter-select {
    flex: 1;
    max-width: none;
  }

}

</style>
