<script setup lang="ts">
import {
  computed,
  onMounted,
  ref
} from "vue";

import {
  useRoute,
  useRouter
} from "vue-router";

import {
  storeToRefs
} from "pinia";

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import MultiSelect from "primevue/multiselect";
import SelectButton from "primevue/selectbutton";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import ToggleSwitch from "primevue/toggleswitch";
import Button from "primevue/button";
import Tag from "primevue/tag";
import Skeleton from "primevue/skeleton";

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


/*
 * Filtros de lista: cada uno admite varios valores.
 * La clave coincide con el parámetro de la URL que usa
 * el dashboard (?estado=...).
 */
type CampoFiltro =
    "estado" |
    "recurso" |
    "responsable" |
    "gerencia" |
    "aplicacion" |
    "anio";

const FILTROS: {
  campo: CampoFiltro;
  nombre: string;
  orden: "cantidad" | "valor";
}[] = [
  { campo: "estado", nombre: "Estado", orden: "cantidad" },
  { campo: "recurso", nombre: "Recurso", orden: "cantidad" },
  { campo: "responsable", nombre: "Responsable", orden: "cantidad" },
  { campo: "gerencia", nombre: "Gerencia", orden: "cantidad" },
  { campo: "aplicacion", nombre: "Aplicación", orden: "cantidad" },
  { campo: "anio", nombre: "Año", orden: "valor" }
];


function filtrosVacios(): Record<CampoFiltro, string[]> {
  return {
    estado: [],
    recurso: [],
    responsable: [],
    gerencia: [],
    aplicacion: [],
    anio: []
  };
}


const busqueda =
    ref("");

/*
 * Se muestran los requerimientos presentes en
 * al menos una de las fuentes seleccionadas.
 */
const fuentesSeleccionadas =
    ref<CodigoFuente[]>(
        FUENTES_FILTRO.map(fuente => fuente.codigo)
    );

const filtros =
    ref(filtrosVacios());

const soloAlertas =
    ref(false);

const filasExpandidas =
    ref<Record<string, boolean>>({});

const tabla =
    ref<{ exportCSV: () => void } | null>(null);


/*
 * El dashboard enlaza aquí con filtros en la URL
 * (?estado=...&fuentes=DT,LS).
 */
function aplicarFiltrosDeUrl() {
  for (const filtro of FILTROS) {
    const dato =
        route.query[filtro.campo];

    if (typeof dato === "string" && dato) {
      filtros.value[filtro.campo] = [dato];
    }
  }

  const fuentes =
      String(route.query.fuentes ?? "")
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
      .filter(item => item.fuentes.includes(codigo))
      .length;
}


const metricas =
    computed(() => [
      {
        titulo: "Total",
        valor: requerimientos.value.length,
        detalle: "Requerimientos consolidados",
        icono: "pi pi-database",
        clase: ""
      },
      {
        titulo: "Demanda Táctica",
        valor: totalFuente("DT"),
        detalle: "Presentes en DT",
        icono: "pi pi-table",
        clase: "dt"
      },
      {
        titulo: "ClearQuest",
        valor: totalFuente("CQ"),
        detalle: "Con actividades en CQ",
        icono: "pi pi-server",
        clase: "cq"
      },
      {
        titulo: "Listado",
        valor: totalFuente("LS"),
        detalle: "Presentes en Listado",
        icono: "pi pi-list",
        clase: "ls"
      },
      {
        titulo: "En las 3 fuentes",
        valor: requerimientos.value.filter(item => item.fuentes.length === 3).length,
        detalle: "DT + Listado + ClearQuest",
        icono: "pi pi-link",
        clase: "both"
      }
    ]);


// =========================================================
// OPCIONES DE FILTRO
// =========================================================

interface OpcionFiltro {
  valor: string;
  etiqueta: string;
}


/*
 * Valores distintos de un campo, con cuántos
 * requerimientos tienen cada uno.
 */
function opciones(
    campo: CampoFiltro,
    orden: "cantidad" | "valor"
): OpcionFiltro[] {
  const conteo =
      new Map<string, number>();

  for (const item of requerimientos.value) {
    const valor =
        item[campo];

    if (valor) {
      conteo.set(
          valor,
          (conteo.get(valor) ?? 0) + 1
      );
    }
  }

  return Array.from(conteo)
      .sort((a, b) =>
          orden === "cantidad"
              ? b[1] - a[1]
              : b[0].localeCompare(a[0], "es", { numeric: true })
      )
      .map(([valor, cantidad]) => ({
        valor,
        etiqueta: `${valor} (${cantidad})`
      }));
}


const opcionesPorFiltro =
    computed(() =>
        Object.fromEntries(
            FILTROS.map(filtro => [
              filtro.campo,
              opciones(filtro.campo, filtro.orden)
            ])
        ) as Record<CampoFiltro, OpcionFiltro[]>
    );


// =========================================================
// FILTROS
// =========================================================

const cantidadFiltros =
    computed(() =>
        FILTROS.filter(filtro => filtros.value[filtro.campo].length > 0).length +
        (fuentesSeleccionadas.value.length !== FUENTES_FILTRO.length ? 1 : 0) +
        (soloAlertas.value ? 1 : 0) +
        (busqueda.value ? 1 : 0)
    );


function limpiarFiltros() {
  busqueda.value = "";
  fuentesSeleccionadas.value =
      FUENTES_FILTRO.map(fuente => fuente.codigo);
  filtros.value = filtrosVacios();
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

      return requerimientos.value.filter(item => {
        if (!item.fuentes.some(fuente => seleccion.includes(fuente))) {
          return false;
        }

        for (const filtro of FILTROS) {
          const valores =
              filtros.value[filtro.campo];

          if (valores.length > 0 && !valores.includes(item[filtro.campo])) {
            return false;
          }
        }

        if (soloAlertas.value && item.alertas.length === 0) {
          return false;
        }

        if (!termino) {
          return true;
        }

        return [
          item.idMantenimiento,
          item.idTramite,
          item.idDemanda,
          item.caso,
          item.nombre,
          item.estado,
          item.recurso,
          item.responsable,
          item.aplicacion,
          item.gerencia
        ]
            .join(" ")
            .toLowerCase()
            .includes(termino);
      });
    });


// =========================================================
// COLUMNAS
// =========================================================

interface ColumnaTabla {
  campo: keyof Requerimiento;
  nombre: string;
}

const COLUMNAS: ColumnaTabla[] = [
  { campo: "idTramite", nombre: "ID Trámite" },
  { campo: "idDemanda", nombre: "ID Demanda / Caso" },
  { campo: "fuentes", nombre: "Fuentes" },
  { campo: "estado", nombre: "Estado" },
  { campo: "recurso", nombre: "Recurso" },
  { campo: "responsable", nombre: "Responsable / Analista" },
  { campo: "gerencia", nombre: "Gerencia" },
  { campo: "aplicacion", nombre: "Aplicación" },
  { campo: "anio", nombre: "Año" }
];

const columnasVisibles =
    ref<ColumnaTabla[]>(
        COLUMNAS.filter(columna =>
            !["gerencia", "anio"].includes(columna.campo)
        )
    );

function visible(
    campo: keyof Requerimiento
): boolean {
  return columnasVisibles.value.some(columna => columna.campo === campo);
}


// =========================================================
// HELPERS
// =========================================================

function claseFuente(
    fuente: CodigoFuente
): string {
  return `source-${fuente.toLowerCase()}`;
}


type Severidad =
    "success" | "info" | "warn" | "danger" | "secondary" | "contrast";

/*
 * Color aproximado del estado según palabras clave,
 * porque cada Excel usa su propio catálogo.
 */
function severidadEstado(
    estado: string
): Severidad {
  const texto =
      estado.toLowerCase();

  if (/finaliz|producci|cerrad|atendid|culminad|complet/.test(texto)) return "success";
  if (/descart|rechaz|anulad|cancel/.test(texto)) return "danger";
  if (/stand|suspend|pospuest|observ|pendiente|espera/.test(texto)) return "warn";
  if (/desarroll|proceso|iniciad|asignad|prueba|qa|certific|análisis|analisis/.test(texto)) return "info";

  return "secondary";
}


function severidadRecurso(
    recurso: string
): Severidad {
  const texto =
      recurso.toLowerCase();

  if (texto.includes("fábrica") || texto.includes("fabrica")) return "info";
  if (texto.includes("bn")) return "success";
  if (texto.includes("proveedor")) return "warn";

  return "secondary";
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


/*
 * Al exportar, las listas (fuentes) van como texto.
 */
function valorExportado(
    { data }: { data: unknown }
): string {
  return Array.isArray(data)
      ? data.join(" + ")
      : String(data ?? "");
}


function exportarCSV() {
  tabla.value?.exportCSV();
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

      <Button
          label="Actualizar"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="cargando"
          @click="store.cargar(true)"
      />

    </div>


    <div class="metrics-grid">
      <div
          v-for="metrica in metricas"
          :key="metrica.titulo"
          class="metric-card"
      >
        <div
            class="metric-icon"
            :class="metrica.clase"
        >
          <i :class="metrica.icono" />
        </div>
        <div>
          <span>{{ metrica.titulo }}</span>
          <strong>{{ metrica.valor }}</strong>
          <small>{{ metrica.detalle }}</small>
        </div>
      </div>
    </div>


    <div class="table-card">

      <div class="table-toolbar">

        <IconField class="search-field">
          <InputIcon class="pi pi-search" />
          <InputText
              v-model="busqueda"
              type="search"
              size="small"
              placeholder="Buscar por mantenimiento, trámite, caso, nombre, responsable..."
              fluid
          />
        </IconField>

        <SelectButton
            v-model="fuentesSeleccionadas"
            :options="FUENTES_FILTRO"
            option-label="nombre"
            option-value="codigo"
            multiple
            size="small"
            aria-label="Filtrar por fuente"
        />

        <div class="toolbar-actions">
          <MultiSelect
              v-model="columnasVisibles"
              :options="COLUMNAS"
              option-label="nombre"
              placeholder="Columnas"
              size="small"
              :max-selected-labels="0"
              selected-items-label="Columnas ({0})"
              class="columns-select"
          />

          <Button
              v-tooltip.bottom="'Descargar la tabla filtrada en CSV'"
              icon="pi pi-download"
              label="CSV"
              severity="secondary"
              outlined
              size="small"
              :disabled="requerimientosFiltrados.length === 0"
              @click="exportarCSV"
          />
        </div>

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
            :filter-placeholder="`Buscar ${filtro.nombre.toLowerCase()}`"
            show-clear
            size="small"
            class="filter-select"
            :class="{ active: filtros[filtro.campo].length > 0 }"
        />

        <label class="filter-check">
          <ToggleSwitch v-model="soloAlertas" />
          Solo con alertas
        </label>

        <Button
            v-if="cantidadFiltros > 0"
            :label="`Limpiar filtros (${cantidadFiltros})`"
            icon="pi pi-filter-slash"
            severity="secondary"
            text
            size="small"
            @click="limpiarFiltros"
        />

        <div class="results-count">
          <strong>{{ requerimientosFiltrados.length }}</strong>
          <span>de {{ requerimientos.length }}</span>
        </div>

      </div>


      <div
          v-if="error"
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

      <DataTable
          v-else
          ref="tabla"
          v-model:expanded-rows="filasExpandidas"
          :value="cargando && requerimientos.length === 0 ? Array(8).fill({}) : requerimientosFiltrados"
          data-key="id"
          paginator
          :rows="25"
          :rows-per-page-options="[25, 50, 100]"
          paginator-template="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          current-page-report-template="{first}–{last} de {totalRecords}"
          sort-mode="multiple"
          removable-sort
          resizable-columns
          column-resize-mode="fit"
          reorderable-columns
          scrollable
          scroll-height="640px"
          row-hover
          striped-rows
          size="small"
          export-filename="requerimientos"
          :export-function="valorExportado"
          class="requirements-table"
          :row-class="() => 'clickable-row'"
          @row-click="!cargando && abrirDetalle($event.data)"
      >

        <template #empty>
          <div class="state-container">
            <div class="state-icon">
              <i :class="requerimientos.length === 0 ? 'pi pi-upload' : 'pi pi-search'" />
            </div>
            <strong>
              {{ requerimientos.length === 0 ? "Todavía no hay registros cargados" : "No se encontraron requerimientos" }}
            </strong>
            <span>
              {{
                requerimientos.length === 0
                    ? "Carga los Excels de Demanda Táctica, ClearQuest y Listado desde Importaciones."
                    : "Prueba con otro término de búsqueda o cambia los filtros."
              }}
            </span>
          </div>
        </template>

        <Column
            expander
            :exportable="false"
            :reorderable-column="false"
            style="width: 2.5rem"
        />

        <Column
            field="idMantenimiento"
            header="ID Mantenimiento"
            sortable
            frozen
            :reorderable-column="false"
        >
          <template #body="{ data }">
            <Skeleton v-if="cargando && !data.id" width="6rem" />
            <span v-else-if="data.idMantenimiento" class="id-value">{{ data.idMantenimiento }}</span>
            <span v-else class="empty-value">—</span>
          </template>
        </Column>

        <Column
            field="nombre"
            header="Requerimiento"
            sortable
            style="min-width: 16rem"
        >
          <template #body="{ data }">
            <Skeleton v-if="cargando && !data.id" />
            <div v-else class="requirement-cell">
              <strong :title="data.nombre">
                {{ data.nombre || "Sin nombre" }}
                <i
                    v-if="data.alertas.length > 0"
                    v-tooltip.top="data.alertas.join('\n')"
                    class="pi pi-exclamation-triangle alert-icon"
                />
              </strong>
              <small v-if="data.compartenMantenimiento > 0">
                Comparte mantenimiento con {{ data.compartenMantenimiento }} más
              </small>
            </div>
          </template>
        </Column>

        <template
            v-for="columna in COLUMNAS"
            :key="columna.campo"
        >
          <Column
              v-if="visible(columna.campo)"
              :field="columna.campo"
              :header="columna.nombre"
              :sortable="columna.campo !== 'fuentes'"
          >
            <template #body="{ data }">
              <Skeleton v-if="cargando && !data.id" width="5rem" />

              <span
                  v-else-if="columna.campo === 'fuentes'"
                  class="source-list"
              >
                <span
                    v-for="fuente in data.fuentes"
                    :key="fuente"
                    class="source-badge"
                    :class="claseFuente(fuente)"
                >
                  {{ fuente }}
                </span>
              </span>

              <Tag
                  v-else-if="columna.campo === 'estado' && data.estado"
                  :value="data.estado"
                  :severity="severidadEstado(data.estado)"
                  class="cell-tag"
              />

              <Tag
                  v-else-if="columna.campo === 'recurso' && data.recurso"
                  :value="data.recurso"
                  :severity="severidadRecurso(data.recurso)"
                  class="cell-tag"
              />

              <span
                  v-else-if="columna.campo === 'idTramite' && data.idTramite"
                  class="id-secondary"
              >
                {{ data.idTramite }}
              </span>

              <span
                  v-else-if="columna.campo === 'idDemanda' && (data.idDemanda || data.caso)"
                  class="id-secondary"
              >
                {{ data.idDemanda || data.caso }}
              </span>

              <span
                  v-else-if="!['idTramite', 'idDemanda', 'estado', 'recurso'].includes(columna.campo) && data[columna.campo]"
              >
                {{ data[columna.campo] }}
              </span>

              <span v-else class="empty-value">—</span>
            </template>
          </Column>
        </template>


        <template #expansion="{ data }">
          <div class="expansion">

            <div class="expansion-grid">
              <div>
                <span>Demanda Táctica</span>
                <strong>{{ data.demandaTactica ? (data.idDemanda || "Sí") : "No está" }}</strong>
              </div>
              <div>
                <span>Casos del Listado</span>
                <strong>{{ data.listado.length ? data.caso : "Ninguno" }}</strong>
              </div>
              <div>
                <span>Actividades ClearQuest</span>
                <strong>{{ data.clearQuest.length || "Ninguna" }}</strong>
              </div>
              <div>
                <span>Gerencia</span>
                <strong>{{ data.gerencia || "—" }}</strong>
              </div>
            </div>

            <ul
                v-if="data.alertas.length"
                class="expansion-alerts"
            >
              <li
                  v-for="alerta in data.alertas"
                  :key="alerta"
              >
                <i class="pi pi-exclamation-triangle" />
                {{ alerta }}
              </li>
            </ul>

            <Button
                label="Ver todos los campos"
                icon="pi pi-arrow-right"
                icon-pos="right"
                size="small"
                @click.stop="abrirDetalle(data)"
            />

          </div>
        </template>

      </DataTable>

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
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--pi-border);
}

.search-field {
  flex: 1;
  min-width: 260px;
  max-width: 460px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.columns-select {
  width: 150px;
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--pi-border);
  background: var(--pi-surface-soft);
}

.filter-select {
  width: 150px;
}

.filter-select.active {
  border-color: var(--pi-primary);
}

.filter-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 4px;
  color: var(--pi-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.results-count {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-left: auto;
  color: var(--pi-text-muted);
  font-size: 11px;
}

.results-count strong {
  color: var(--pi-text);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.requirements-table :deep(.p-datatable-tbody > tr > td) {
  font-size: 12px;
}

.requirements-table :deep(.p-datatable-thead > tr > th) {
  color: var(--pi-text-secondary);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.requirements-table :deep(.p-datatable-column-title) {
  font-size: 11px;
  font-weight: 650;
}

.requirements-table :deep(.clickable-row) {
  cursor: pointer;
}

.requirements-table :deep(.p-datatable-paginator-bottom) {
  border-top: 1px solid var(--pi-border);
}

.requirement-cell {
  display: flex;
  flex-direction: column;
  max-width: 360px;
}

.requirement-cell strong {
  overflow: hidden;
  color: var(--pi-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requirement-cell small {
  margin-top: 2px;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.alert-icon {
  margin-left: 4px;
  color: var(--pi-warning);
  font-size: 11px;
}

.id-value {
  color: var(--pi-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.id-secondary {
  color: var(--pi-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  white-space: nowrap;
}

.empty-value {
  color: var(--pi-text-muted);
}

.cell-tag {
  font-size: 10px;
  white-space: nowrap;
}

.source-list {
  display: inline-flex;
  gap: 4px;
}

.source-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 10px;
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

.expansion {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 8px 10px 44px;
}

.expansion-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, auto));
  gap: 8px 28px;
}

.expansion-grid span {
  display: block;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.expansion-grid strong {
  color: var(--pi-text);
  font-size: 12px;
  font-weight: 600;
}

.expansion-alerts {
  margin: 0;
  padding: 0;
  list-style: none;
}

.expansion-alerts li {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--pi-warning);
  font-size: 11px;
}

.state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: 260px;
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

.state-icon.error {
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
}

.state-container strong {
  color: var(--pi-text);
  font-size: 12px;
}

.state-container span {
  max-width: 420px;
  margin-top: 4px;
  color: var(--pi-text-muted);
  font-size: 11px;
}

@media (max-width: 1050px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-actions,
  .results-count {
    margin-left: 0;
  }

  .expansion-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 650px) {
  .page-intro {
    flex-direction: column;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .search-field,
  .filter-select {
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>
