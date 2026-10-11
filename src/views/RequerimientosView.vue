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

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import MultiSelect from "primevue/multiselect";
import SelectButton from "primevue/selectbutton";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Tag from "primevue/tag";
import Skeleton from "primevue/skeleton";

import {
  useRequerimientosStore
} from "../stores/requerimientosStore";

import {
  useAlertasStore
} from "../stores/alertasStore";

import AlertaTag from "../components/alertas/AlertaTag.vue";

import {
  NIVELES_ALERTA
} from "../services/alertasService";

import type {
  NivelAlerta
} from "../services/alertasService";

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

const alertasStore =
    useAlertasStore();


/*
 * Filtro por alerta: de fin de desarrollo o diferencias
 * entre fuentes. Los valores elegidos se suman (O).
 */
type FiltroAlerta =
    NivelAlerta | "MODIFICADA" | "DIFERENCIAS";

const OPCIONES_ALERTA: { valor: FiltroAlerta; nombre: string }[] = [
  ...(Object.keys(NIVELES_ALERTA) as NivelAlerta[]).map(nivel => ({
    valor: nivel as FiltroAlerta,
    nombre: NIVELES_ALERTA[nivel].nombre
  })),
  { valor: "MODIFICADA", nombre: "Fecha modificada" },
  { valor: "DIFERENCIAS", nombre: "Diferencias entre fuentes" }
];

const filtroAlerta =
    ref<FiltroAlerta[]>([]);

function cumpleAlerta(
    item: Requerimiento
): boolean {
  if (filtroAlerta.value.length === 0) {
    return true;
  }

  if (filtroAlerta.value.includes("DIFERENCIAS") && item.alertas.length > 0) {
    return true;
  }

  const alerta =
      alertasStore.porRequerimiento.get(item.id);

  if (!alerta) {
    return false;
  }

  return (alerta.nivel !== null && filtroAlerta.value.includes(alerta.nivel)) ||
      (alerta.fechaModificada !== null && filtroAlerta.value.includes("MODIFICADA"));
}

/*
 * Para ordenar por alerta: vencidos primero.
 */
function ordenAlerta(
    item: Requerimiento
): string {
  const alerta =
      alertasStore.porRequerimiento.get(item.id);

  if (!alerta) return "9";
  if (!alerta.nivel) return "5";

  return String(NIVELES_ALERTA[alerta.nivel].orden);
}


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
    "categoria" |
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
  { campo: "categoria", nombre: "Categoría", orden: "cantidad" },
  { campo: "recurso", nombre: "Recurso", orden: "cantidad" },
  { campo: "responsable", nombre: "Responsable", orden: "cantidad" },
  { campo: "gerencia", nombre: "Gerencia", orden: "cantidad" },
  { campo: "aplicacion", nombre: "Aplicación", orden: "cantidad" },
  { campo: "anio", nombre: "Año", orden: "valor" }
];


function filtrosVacios(): Record<CampoFiltro, string[]> {
  return {
    estado: [],
    categoria: [],
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

  const alerta =
      route.query.alerta;

  if (typeof alerta === "string" && OPCIONES_ALERTA.some(opcion => opcion.valor === alerta)) {
    filtroAlerta.value = [alerta as FiltroAlerta];
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
  alertasStore.cargar();
});


// =========================================================
// FUENTES
// =========================================================

/*
 * Botones de fuente con cuántos requerimientos hay en cada una.
 */
const opcionesFuente =
    computed(() =>
        FUENTES_FILTRO.map(fuente => ({
          codigo: fuente.codigo,
          nombre: `${fuente.nombre} ${requerimientos.value
              .filter(item => item.fuentes.includes(fuente.codigo))
              .length}`
        }))
    );


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
        (filtroAlerta.value.length > 0 ? 1 : 0) +
        (busqueda.value ? 1 : 0)
    );


function limpiarFiltros() {
  busqueda.value = "";
  fuentesSeleccionadas.value =
      FUENTES_FILTRO.map(fuente => fuente.codigo);
  filtros.value = filtrosVacios();
  filtroAlerta.value = [];
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

        if (!cumpleAlerta(item)) {
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
          item.categoria,
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
  ancho: string;
}

/*
 * Columnas opcionales, a la derecha de las fijas (ID Mantenimiento
 * y Requerimiento). El ancho es fijo para que la tabla no salte
 * al cambiar de página o de filtro.
 */
const COLUMNAS: ColumnaTabla[] = [
  { campo: "idDemanda", nombre: "ID Demanda / Caso", ancho: "8.5rem" },
  { campo: "fuentes", nombre: "Fuentes", ancho: "8rem" },
  { campo: "estado", nombre: "Estado", ancho: "13rem" },
  { campo: "categoria", nombre: "Categoría", ancho: "8.5rem" },
  { campo: "recurso", nombre: "Recurso", ancho: "9rem" },
  { campo: "responsable", nombre: "Responsable / Analista", ancho: "12rem" },
  { campo: "aplicacion", nombre: "Aplicación", ancho: "12rem" },
  { campo: "idTramite", nombre: "ID Trámite", ancho: "8rem" },
  { campo: "gerencia", nombre: "Gerencia", ancho: "13rem" },
  { campo: "anio", nombre: "Año", ancho: "5rem" }
];

const OCULTAS_POR_DEFECTO =
    ["idTramite", "gerencia", "anio"];


/*
 * Preferencias de la tabla guardadas en el navegador
 * (columnas visibles y filas por página).
 */
const CLAVE_PREFERENCIAS =
    "pi.requerimientos.tabla";

interface PreferenciasTabla {
  columnas: string[];
  filas: number;
}

function leerPreferencias(): Partial<PreferenciasTabla> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) ?? "{}");
  } catch {
    return {};
  }
}

const preferencias =
    leerPreferencias();

const columnasVisibles =
    ref<ColumnaTabla[]>(
        COLUMNAS.filter(columna =>
            preferencias.columnas
                ? preferencias.columnas.includes(columna.campo)
                : !OCULTAS_POR_DEFECTO.includes(columna.campo)
        )
    );

const filasPorPagina =
    ref(preferencias.filas ?? 50);

watch(
    [columnasVisibles, filasPorPagina],
    () => {
      try {
        localStorage.setItem(
            CLAVE_PREFERENCIAS,
            JSON.stringify({
              columnas: columnasVisibles.value.map(columna => columna.campo),
              filas: filasPorPagina.value
            } satisfies PreferenciasTabla)
        );
      } catch {
        // Sin almacenamiento disponible: se usan los valores por defecto.
      }
    }
);

/*
 * Se respetan el orden de COLUMNAS aunque se elijan en otro orden.
 */
const columnasMostradas =
    computed(() =>
        COLUMNAS.filter(columna =>
            columnasVisibles.value.some(visible => visible.campo === columna.campo)
        )
    );

function anchoColumna(
    ancho: string
): Record<string, string> {
  return {
    width: ancho,
    minWidth: ancho,
    maxWidth: ancho
  };
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


function severidadCategoria(
    categoria: string
): Severidad {
  const texto =
      categoria.toLowerCase();

  if (texto.startsWith("correc")) return "danger";
  if (texto.startsWith("normativ") || texto.startsWith("mandator")) return "warn";
  if (texto.startsWith("evolutiv")) return "info";
  if (texto.startsWith("adaptativ")) return "success";

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

    <Teleport defer to="#topbar-acciones">
      <Button
          label="Actualizar"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="cargando"
          @click="store.cargar(true)"
      />
    </Teleport>


    <div class="table-card">

      <!-- Búsqueda, fuentes y acciones de la tabla: no se desplazan. -->
      <div class="table-toolbar">

        <IconField class="search-field">
          <InputIcon class="pi pi-search" />
          <InputText
              v-model="busqueda"
              type="search"
              size="small"
              placeholder="Buscar por ID, nombre, responsable, aplicación..."
              aria-label="Buscar requerimientos"
              fluid
          />
        </IconField>

        <SelectButton
            v-model="fuentesSeleccionadas"
            :options="opcionesFuente"
            option-label="nombre"
            option-value="codigo"
            multiple
            size="small"
            class="sources-select"
            aria-label="Filtrar por fuente"
        />

        <div class="toolbar-actions">
          <div
              class="results-count"
              aria-live="polite"
          >
            <strong>{{ requerimientosFiltrados.length }}</strong>
            <span>de {{ requerimientos.length }} requerimientos</span>
          </div>

          <MultiSelect
              v-model="columnasVisibles"
              :options="COLUMNAS"
              option-label="nombre"
              placeholder="Columnas"
              size="small"
              :max-selected-labels="0"
              selected-items-label="Columnas ({0})"
              class="columns-select"
              aria-label="Columnas visibles"
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


      <!-- Filtros combinables: se aplican todos a la vez. -->
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
            :aria-label="`Filtrar por ${filtro.nombre.toLowerCase()}`"
        />

        <MultiSelect
            v-model="filtroAlerta"
            :options="OPCIONES_ALERTA"
            option-label="nombre"
            option-value="valor"
            placeholder="Alerta"
            selected-items-label="Alerta ({0})"
            :max-selected-labels="1"
            show-clear
            size="small"
            class="filter-select"
            :class="{ active: filtroAlerta.length > 0 }"
            aria-label="Filtrar por alerta de desarrollo"
        />

        <Button
            :label="cantidadFiltros > 0 ? `Limpiar filtros (${cantidadFiltros})` : 'Limpiar filtros'"
            icon="pi pi-filter-slash"
            severity="secondary"
            text
            size="small"
            class="clear-filters"
            :disabled="cantidadFiltros === 0"
            @click="limpiarFiltros"
        />

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

      <!--
        Solo esta zona hace scroll (vertical y horizontal). La cabecera
        de la tabla y las columnas de identificación quedan fijas.
      -->
      <div
          v-else
          class="table-body"
      >
        <DataTable
            ref="tabla"
            v-model:expanded-rows="filasExpandidas"
            v-model:rows="filasPorPagina"
            :value="cargando && requerimientos.length === 0 ? Array(12).fill({}) : requerimientosFiltrados"
            data-key="id"
            paginator
            :rows-per-page-options="[25, 50, 100, 200]"
            paginator-template="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            current-page-report-template="{first}–{last} de {totalRecords}"
            sort-mode="multiple"
            removable-sort
            resizable-columns
            column-resize-mode="expand"
            scrollable
            scroll-height="flex"
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
                      : "Prueba con otro término de búsqueda o limpia los filtros."
                }}
              </span>
            </div>
          </template>

          <Column
              expander
              frozen
              :exportable="false"
              :style="anchoColumna('2.5rem')"
          />

          <Column
              field="idMantenimiento"
              header="ID Mantenimiento"
              sortable
              frozen
              :style="anchoColumna('8.5rem')"
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
              frozen
              header-class="frozen-edge"
              body-class="frozen-edge"
              :style="anchoColumna('22rem')"
          >
            <template #body="{ data }">
              <Skeleton v-if="cargando && !data.id" />
              <div v-else class="requirement-cell">
                <strong :title="data.nombre">
                  {{ data.nombre || "Sin nombre" }}
                </strong>
                <i
                    v-if="data.alertas.length > 0"
                    v-tooltip.top="data.alertas.join('\n')"
                    class="pi pi-exclamation-triangle alert-icon"
                    aria-label="Diferencias entre fuentes"
                />
              </div>
            </template>
          </Column>

          <Column
              header="Alerta"
              :sort-field="ordenAlerta"
              sortable
              :exportable="false"
              :style="anchoColumna('8.5rem')"
          >
            <template #body="{ data }">
              <Skeleton v-if="cargando && !data.id" width="4rem" />
              <AlertaTag
                  v-else-if="alertasStore.porRequerimiento.get(data.id)"
                  :alerta="alertasStore.porRequerimiento.get(data.id)!"
              />
            </template>
          </Column>

          <Column
              v-for="columna in columnasMostradas"
              :key="columna.campo"
              :field="columna.campo"
              :header="columna.nombre"
              :sortable="columna.campo !== 'fuentes'"
              :style="anchoColumna(columna.ancho)"
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
                  v-tooltip.top="data.estado"
                  :value="data.estado"
                  :severity="severidadEstado(data.estado)"
                  class="cell-tag"
              />

              <Tag
                  v-else-if="columna.campo === 'categoria' && data.categoria"
                  :value="data.categoria"
                  :severity="severidadCategoria(data.categoria)"
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
                  v-else-if="!['idTramite', 'idDemanda', 'estado', 'categoria', 'recurso'].includes(columna.campo) && data[columna.campo]"
                  class="cell-text"
                  :title="String(data[columna.campo])"
              >
                {{ data[columna.campo] }}
              </span>

              <span v-else class="empty-value">—</span>
            </template>
          </Column>


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
                <div v-if="data.compartenMantenimiento > 0">
                  <span>Mismo mantenimiento</span>
                  <strong>{{ data.compartenMantenimiento }} requerimientos más</strong>
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

    </div>

  </section>
</template>


<style scoped>
/*
 * La página ocupa el alto que le da el layout (pantallaCompleta).
 * Barra y filtros quedan arriba; solo .table-body hace scroll.
 */
.requirements-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.table-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
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
  gap: 8px 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--pi-border);
}

.search-field {
  flex: 1 1 260px;
  max-width: 420px;
}

.sources-select :deep(.p-togglebutton) {
  font-size: 11px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.results-count {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-right: 4px;
  color: var(--pi-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.results-count strong {
  color: var(--pi-text);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.columns-select {
  width: 140px;
}

.filters-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--pi-border);
  background: var(--pi-surface-soft);
}

/* En pantallas anchas los filtros encogen para caber en una sola fila. */
.filter-select {
  flex: 1 1 128px;
  min-width: 96px;
  max-width: 170px;
}

.filter-select.active {
  border-color: var(--pi-primary);
  background: var(--pi-primary-soft);
}

.clear-filters {
  flex-shrink: 0;
  margin-left: auto;
  white-space: nowrap;
}

.table-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.requirements-table {
  flex: 1;
  min-height: 0;
}

.requirements-table :deep(.p-datatable-tbody > tr > td) {
  padding-top: 6px;
  padding-bottom: 6px;
  font-size: 12px;
  white-space: nowrap;
}

.requirements-table :deep(.p-datatable-thead > tr > th) {
  padding-top: 8px;
  padding-bottom: 8px;
  background: var(--pi-surface-soft);
  color: var(--pi-text-secondary);
  white-space: nowrap;
}

.requirements-table :deep(.p-datatable-column-title) {
  font-size: 11px;
  font-weight: 650;
}

/* Sombra que marca dónde terminan las columnas fijas al hacer scroll horizontal. */
.requirements-table :deep(.frozen-edge) {
  box-shadow: inset -1px 0 0 var(--pi-border);
}

.requirements-table :deep(.clickable-row) {
  cursor: pointer;
}

.requirements-table :deep(.p-datatable-paginator-bottom) {
  border-top: 1px solid var(--pi-border);
}

.requirements-table :deep(.p-paginator) {
  padding: 4px 8px;
}

.requirement-cell {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.requirement-cell strong {
  overflow: hidden;
  color: var(--pi-text);
  font-weight: 600;
  text-overflow: ellipsis;
}

.alert-icon {
  flex-shrink: 0;
  color: var(--pi-warning);
  font-size: 11px;
}

.cell-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.id-value {
  color: var(--pi-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 650;
}

.id-secondary {
  color: var(--pi-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.empty-value {
  color: var(--pi-text-muted);
}

.cell-tag {
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  white-space: nowrap;
}

.cell-tag :deep(.p-tag-label) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-list {
  display: inline-flex;
  gap: 4px;
}

.source-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 650;
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
  gap: 10px;
  padding: 4px 8px 8px 44px;
}

.expansion-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(130px, auto));
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
  min-height: 240px;
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

@media (max-width: 1200px) {
  .toolbar-actions {
    margin-left: 0;
  }

  .filters-row {
    flex-wrap: wrap;
  }

  .filter-select {
    flex: 0 1 128px;
  }

  .expansion-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 650px) {
  .search-field,
  .filter-select {
    flex: 1 1 100%;
    max-width: none;
  }

  .clear-filters {
    margin-left: 0;
  }
}
</style>
