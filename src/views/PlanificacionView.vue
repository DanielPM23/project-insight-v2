<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import Button from "primevue/button";

import PlanificacionCalendario from "../components/planificacion/PlanificacionCalendario.vue";
import type { VistaCalendario } from "../components/planificacion/PlanificacionCalendario.vue";
import PlanificacionDetalle from "../components/planificacion/PlanificacionDetalle.vue";
import EstadoTemporalTag from "../components/planificacion/EstadoTemporalTag.vue";
import FuenteBadge from "../components/planificacion/FuenteBadge.vue";
import "../components/planificacion/estados.css";

import {
  ESTADOS_TEMPORALES,
  GRUPOS_EVENTO,
  PROBLEMAS,
  construirPlanificacion,
  generarEventos,
  leerFechaISO,
  proximosVencimientos,
  sinPlanificacion
} from "../services/planificacionService";

import type { RangoFechas } from "../services/planificacionService";
import { textoDias } from "../services/alertasService";

import type {
  EstadoTemporal,
  GrupoEvento,
  PlanificacionEvento,
  PlanificacionRequerimiento,
  TipoProblema
} from "../models/Planificacion";

import type { CodigoFuente } from "../config/sourceSchemas";

import { useAlertasStore } from "../stores/alertasStore";
import { useRequerimientosStore } from "../stores/requerimientosStore";
import { formatearFecha } from "../utils/fechas";


/*
 * Planificación: cuándo empieza y termina cada desarrollo.
 *
 * Usa los requerimientos ya cargados en el store y la
 * configuración de Alertas (días de anticipación y estados
 * terminados): no hace lecturas propias a Firestore.
 */

const route = useRoute();
const router = useRouter();

const requerimientosStore = useRequerimientosStore();
const alertasStore = useAlertasStore();

const { requerimientos, porId } = storeToRefs(requerimientosStore);
const { configuracion, cargando, cargado, error } = storeToRefs(alertasStore);

onMounted(() => alertasStore.cargar());


// =========================================================
// PESTAÑAS
// =========================================================

/*
 * Para sumar "Timeline" más adelante basta con agregarla
 * aquí y su contenido en el template.
 */
type Pestana = "calendario" | "proximos" | "sin";

const pestana = ref<Pestana>("calendario");


// =========================================================
// PREFERENCIAS (vista y tipos de evento)
// =========================================================

const CLAVE_PREFERENCIAS = "pi.planificacion";

const GRUPOS_POR_DEFECTO =
    (Object.keys(GRUPOS_EVENTO) as GrupoEvento[]).filter(grupo => GRUPOS_EVENTO[grupo].porDefecto);

function leerPreferencias(): { vista?: VistaCalendario; grupos?: GrupoEvento[] } {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) ?? "{}");
  } catch {
    return {};
  }
}

const preferencias = leerPreferencias();

const vista = ref<VistaCalendario>(preferencias.vista === "semana" ? "semana" : "mes");

const grupos = ref<GrupoEvento[]>(
    Array.isArray(preferencias.grupos)
        ? preferencias.grupos.filter(grupo => grupo in GRUPOS_EVENTO)
        : [...GRUPOS_POR_DEFECTO]
);

watch([vista, grupos], () => {
  try {
    localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify({ vista: vista.value, grupos: grupos.value }));
  } catch {
    // Sin almacenamiento: valen solo para esta visita.
  }
});

const OPCIONES_GRUPO =
    (Object.keys(GRUPOS_EVENTO) as GrupoEvento[]).map(grupo => ({ valor: grupo, nombre: GRUPOS_EVENTO[grupo].nombre }));


// =========================================================
// DATOS
// =========================================================

/*
 * Se normalizan las fechas y se calcula el estado temporal
 * una sola vez por carga; los filtros trabajan sobre esto.
 */
const items = computed(() =>
    construirPlanificacion(requerimientos.value, configuracion.value)
);


// =========================================================
// FILTROS
// =========================================================

type CampoFiltro = "responsable" | "estado" | "categoria" | "recurso";

interface Opcion {
  valor: string | null;
  etiqueta: string;
}

const FILTROS: { campo: CampoFiltro; nombre: string; todos: string }[] = [
  { campo: "responsable", nombre: "Responsable", todos: "Todos" },
  { campo: "estado", nombre: "Estado", todos: "Todos" },
  { campo: "categoria", nombre: "Categoría", todos: "Todas" },
  { campo: "recurso", nombre: "Recurso", todos: "Todos" }
];

const FUENTES: { valor: CodigoFuente; etiqueta: string }[] = [
  { valor: "DT", etiqueta: "Demanda Táctica" },
  { valor: "CQ", etiqueta: "ClearQuest" },
  { valor: "LS", etiqueta: "Listado" }
];

/*
 * Opciones del filtro rápido por situación (lo activan
 * los indicadores o ?estadoTemporal=).
 */
const OPCIONES_SITUACION: Opcion[] = [
  { valor: null, etiqueta: "Todas" },
  ...(["VENCIDO", "VENCE_HOY", "PROXIMO", "EN_PLAZO", "FINALIZADO"] as EstadoTemporal[])
      .map(estado => ({ valor: estado, etiqueta: ESTADOS_TEMPORALES[estado].nombre }))
];

function filtrosVacios(): Record<CampoFiltro, string | null> {
  return { responsable: null, estado: null, categoria: null, recurso: null };
}

const busqueda = ref("");
const fuente = ref<CodigoFuente | null>(null);
const filtros = ref(filtrosVacios());
const estadoTemporal = ref<EstadoTemporal | null>(null);

/*
 * Valores de cada filtro con cuántos requerimientos tienen,
 * más la opción "Todos".
 */
const opciones = computed(() => {
  const resultado = {} as Record<CampoFiltro, Opcion[]>;

  for (const filtro of FILTROS) {
    const conteo = new Map<string, number>();

    for (const item of items.value) {
      const valor = item[filtro.campo];

      if (valor) {
        conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
      }
    }

    resultado[filtro.campo] = [
      { valor: null, etiqueta: filtro.todos },
      ...Array.from(conteo)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
          .map(([valor, cantidad]) => ({ valor, etiqueta: `${valor} (${cantidad})` }))
    ];
  }

  return resultado;
});

const opcionesFuente = computed<Opcion[]>(() => [
  { valor: null, etiqueta: "Todas" },
  ...FUENTES.map(opcion => ({
    valor: opcion.valor,
    etiqueta: `${opcion.etiqueta} (${items.value.filter(item => item.fuentes.includes(opcion.valor)).length})`
  }))
]);


/*
 * Filtros globales: valen para el calendario, las dos
 * tablas y los indicadores.
 */
const base = computed(() => {
  const termino = busqueda.value.trim().toLowerCase();
  const activos = FILTROS.filter(filtro => filtros.value[filtro.campo] !== null);

  return items.value.filter(item =>
      (!fuente.value || item.fuentes.includes(fuente.value)) &&
      activos.every(filtro => item[filtro.campo] === filtros.value[filtro.campo]) &&
      (!termino || item.textoBusqueda.includes(termino))
  );
});

/*
 * Además, el filtro rápido de los indicadores.
 */
const filtrados = computed(() =>
    estadoTemporal.value
        ? base.value.filter(item => item.estadoTemporal === estadoTemporal.value)
        : base.value
);

const cantidadFiltros = computed(() =>
    (busqueda.value.trim() ? 1 : 0) +
    (fuente.value ? 1 : 0) +
    FILTROS.filter(filtro => filtros.value[filtro.campo] !== null).length +
    (estadoTemporal.value ? 1 : 0)
);

function limpiarFiltros() {
  busqueda.value = "";
  fuente.value = null;
  filtros.value = filtrosVacios();
  estadoTemporal.value = null;
}


// =========================================================
// INDICADORES
// =========================================================

/*
 * "Sin planificación" es su propia situación: no depende
 * del filtro rápido de los indicadores.
 */
const sinPlan = computed(() => sinPlanificacion(base.value));

const kpis = computed(() => {
  const conteo: Partial<Record<EstadoTemporal, number>> = {};

  for (const item of base.value) {
    conteo[item.estadoTemporal] = (conteo[item.estadoTemporal] ?? 0) + 1;
  }

  return [
    { estado: "EN_PLAZO" as const, titulo: "En plazo", valor: conteo.EN_PLAZO ?? 0 },
    { estado: "PROXIMO" as const, titulo: `Próximos ${configuracion.value.diasAnticipacion} días`, valor: conteo.PROXIMO ?? 0 },
    { estado: "VENCE_HOY" as const, titulo: "Vencen hoy", valor: conteo.VENCE_HOY ?? 0 },
    { estado: "VENCIDO" as const, titulo: "Vencidos", valor: conteo.VENCIDO ?? 0 },
    { estado: "SIN_PLANIFICACION" as const, titulo: "Sin planificación", valor: sinPlan.value.length }
  ];
});

/*
 * Un clic deja solo ese estado; otro clic lo quita. "Sin
 * planificación" abre su pestaña.
 */
function alElegirKpi(estado: EstadoTemporal) {
  if (estado === "SIN_PLANIFICACION") {
    estadoTemporal.value = null;
    pestana.value = "sin";
    return;
  }

  estadoTemporal.value = estadoTemporal.value === estado ? null : estado;

  if (pestana.value === "sin") {
    pestana.value = "proximos";
  }
}


// =========================================================
// CALENDARIO
// =========================================================

const calendario = ref<InstanceType<typeof PlanificacionCalendario> | null>(null);
const rango = ref<RangoFechas | null>(null);

const fechaInicial = leerFechaISO(route.query.fecha) ?? new Date();

/*
 * Solo los eventos del rango visible.
 */
const eventos = computed(() =>
    rango.value
        ? generarEventos(filtrados.value, new Set(grupos.value), rango.value)
        : []
);

const proximos = computed(() => proximosVencimientos(filtrados.value));


// =========================================================
// DETALLE
// =========================================================

const seleccionado = ref<PlanificacionRequerimiento | null>(null);
const detalleVisible = ref(false);

function abrir(item: PlanificacionRequerimiento) {
  seleccionado.value = item;
  detalleVisible.value = true;
}

function alSeleccionarEvento(evento: PlanificacionEvento) {
  abrir(evento.requerimiento);
}


// =========================================================
// SIN PLANIFICACIÓN: tipo de problema
// =========================================================

const problemasElegidos = ref<TipoProblema[]>([]);

const opcionesProblema = computed(() => {
  const conteo = new Map<TipoProblema, number>();

  for (const item of sinPlan.value) {
    for (const tipo of new Set(item.problemas.map(problema => problema.tipoProblema))) {
      conteo.set(tipo, (conteo.get(tipo) ?? 0) + 1);
    }
  }

  return (Object.keys(PROBLEMAS) as TipoProblema[])
      .filter(tipo => conteo.has(tipo))
      .map(tipo => ({ valor: tipo, etiqueta: `${PROBLEMAS[tipo]} (${conteo.get(tipo)})` }));
});

const filasSinPlan = computed(() =>
    problemasElegidos.value.length === 0
        ? sinPlan.value
        : sinPlan.value.filter(item => item.problemas.some(problema => problemasElegidos.value.includes(problema.tipoProblema)))
);


// =========================================================
// URL
// =========================================================

/*
 * Filtros por URL desde otras vistas:
 * /planificacion?estadoTemporal=VENCIDO&responsable=...
 * ?id=<requerimiento> abre su resumen y lleva el
 * calendario a su fecha final.
 */
const ESTADOS_URL = Object.keys(ESTADOS_TEMPORALES) as EstadoTemporal[];

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor ? valor : null;
}

function aplicarUrl() {
  const query = route.query;

  for (const filtro of FILTROS) {
    filtros.value[filtro.campo] = texto(query[filtro.campo]);
  }

  const codigo = texto(query.fuente);
  fuente.value = FUENTES.some(opcion => opcion.valor === codigo) ? codigo as CodigoFuente : null;

  const estado = texto(query.estadoTemporal);
  estadoTemporal.value = ESTADOS_URL.includes(estado as EstadoTemporal) ? estado as EstadoTemporal : null;

  busqueda.value = texto(query.q) ?? "";

  const tab = texto(query.tab);
  pestana.value = tab === "proximos" || tab === "sin" ? tab : "calendario";
}

aplicarUrl();

watch(
    [busqueda, fuente, filtros, estadoTemporal, pestana],
    () => {
      const query: Record<string, string> = {};

      for (const filtro of FILTROS) {
        const valor = filtros.value[filtro.campo];
        if (valor) query[filtro.campo] = valor;
      }

      if (fuente.value) query.fuente = fuente.value;
      if (estadoTemporal.value) query.estadoTemporal = estadoTemporal.value;
      if (busqueda.value.trim()) query.q = busqueda.value.trim();
      if (pestana.value !== "calendario") query.tab = pestana.value;

      router.replace({ query });
    },
    { deep: true }
);

/*
 * ?id= se atiende una vez, cuando ya hay datos. Una copia
 * por caso del Listado se abre como su requerimiento de DT.
 */
let idPendiente = texto(route.query.id);

function abrirPendiente() {
  if (!idPendiente || items.value.length === 0 || !calendario.value) {
    return;
  }

  const id = porId.value.get(idPendiente)?.copiaDe || idPendiente;
  const item = items.value.find(candidato => candidato.id === id);

  idPendiente = null;

  if (item) {
    abrir(item);

    const fecha = item.fechaFin ?? item.fechaInicio;

    if (fecha && !route.query.fecha) {
      calendario.value.irA(fecha);
    }
  }
}

onMounted(abrirPendiente);
watch(items, abrirPendiente);
</script>


<template>
  <section class="planificacion">

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

    <div v-if="error || requerimientosStore.error" class="error-box" role="alert">
      <i class="pi pi-exclamation-triangle" />
      {{ error || requerimientosStore.error }}
    </div>

    <!-- Pestañas e indicadores -->
    <div class="cabecera">
      <nav class="pestanas" role="tablist" aria-label="Vistas de planificación">
        <button
            type="button"
            role="tab"
            :aria-selected="pestana === 'calendario'"
            :class="{ activa: pestana === 'calendario' }"
            @click="pestana = 'calendario'"
        >
          <i class="pi pi-calendar" /> Calendario
        </button>
        <button
            type="button"
            role="tab"
            :aria-selected="pestana === 'proximos'"
            :class="{ activa: pestana === 'proximos' }"
            @click="pestana = 'proximos'"
        >
          <i class="pi pi-clock" /> Próximos vencimientos
          <span class="contador">{{ proximos.length }}</span>
        </button>
        <button
            type="button"
            role="tab"
            :aria-selected="pestana === 'sin'"
            :class="{ activa: pestana === 'sin' }"
            @click="pestana = 'sin'"
        >
          <i class="pi pi-exclamation-triangle" /> Sin planificación
          <span class="contador">{{ sinPlan.length }}</span>
        </button>
      </nav>

      <div class="kpis" aria-label="Indicadores">
        <button
            v-for="kpi in kpis"
            :key="kpi.estado"
            v-tooltip.bottom="kpi.estado === 'SIN_PLANIFICACION' ? 'Ver requerimientos sin planificación completa' : `Mostrar solo: ${ESTADOS_TEMPORALES[kpi.estado].nombre}`"
            type="button"
            class="kpi"
            :class="[ESTADOS_TEMPORALES[kpi.estado].clase, { activo: estadoTemporal === kpi.estado || (kpi.estado === 'SIN_PLANIFICACION' && pestana === 'sin') }]"
            :aria-pressed="estadoTemporal === kpi.estado"
            @click="alElegirKpi(kpi.estado)"
        >
          <i class="marca" />
          <span>{{ kpi.titulo }}</span>
          <strong>{{ cargado || kpi.valor ? kpi.valor : "…" }}</strong>
        </button>
      </div>
    </div>

    <!-- Filtros globales -->
    <div class="filtros">
      <IconField class="busqueda">
        <InputIcon class="pi pi-search" />
        <InputText
            v-model="busqueda"
            type="search"
            size="small"
            placeholder="ID mantenimiento, trámite, demanda o nombre"
            aria-label="Buscar requerimientos"
            fluid
        />
      </IconField>

      <label class="filtro" :class="{ activo: fuente }">
        <span>Fuente</span>
        <Select
            v-model="fuente"
            :options="opcionesFuente"
            option-label="etiqueta"
            option-value="valor"
            placeholder="Todas"
            size="small"
            class="selector"
        />
      </label>

      <label
          v-for="filtro in FILTROS"
          :key="filtro.campo"
          class="filtro"
          :class="{ activo: filtros[filtro.campo] }"
      >
        <span>{{ filtro.nombre }}</span>
        <Select
            v-model="filtros[filtro.campo]"
            :options="opciones[filtro.campo]"
            option-label="etiqueta"
            option-value="valor"
            :placeholder="filtro.todos"
            filter
            :filter-placeholder="`Buscar ${filtro.nombre.toLowerCase()}`"
            size="small"
            class="selector"
        />
      </label>

      <label v-if="estadoTemporal" class="filtro activo">
        <span>Situación</span>
        <Select
            v-model="estadoTemporal"
            :options="OPCIONES_SITUACION"
            option-label="etiqueta"
            option-value="valor"
            size="small"
            class="selector"
        />
      </label>

      <MultiSelect
          v-if="pestana === 'calendario'"
          v-model="grupos"
          :options="OPCIONES_GRUPO"
          option-label="nombre"
          option-value="valor"
          :show-toggle-all="false"
          :max-selected-labels="0"
          selected-items-label="Eventos ({0})"
          placeholder="Eventos (0)"
          size="small"
          class="eventos"
          aria-label="Mostrar eventos"
      >
        <template #header>
          <div class="eventos-titulo">Mostrar eventos</div>
        </template>
      </MultiSelect>

      <Button
          :label="cantidadFiltros ? `Limpiar (${cantidadFiltros})` : 'Limpiar'"
          icon="pi pi-filter-slash"
          severity="secondary"
          text
          size="small"
          :disabled="cantidadFiltros === 0"
          @click="limpiarFiltros"
      />

      <span class="resultado" aria-live="polite">
        <strong>{{ filtrados.length }}</strong> de {{ items.length }}
      </span>
    </div>

    <!-- Contenido -->
    <div class="panel">
      <PlanificacionCalendario
          v-show="pestana === 'calendario'"
          ref="calendario"
          v-model:vista="vista"
          :eventos="eventos"
          :fecha-inicial="fechaInicial"
          @rango="rango = $event"
          @seleccionar="alSeleccionarEvento"
      />

      <DataTable
          v-if="pestana === 'proximos'"
          :value="proximos"
          :loading="cargando && !cargado"
          data-key="id"
          scrollable
          scroll-height="flex"
          paginator
          :rows="50"
          :rows-per-page-options="[25, 50, 100]"
          paginator-template="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          current-page-report-template="{first}–{last} de {totalRecords}"
          size="small"
          row-hover
          class="tabla"
          :row-class="item => (item.id === seleccionado?.id && detalleVisible ? 'seleccionada' : '')"
          @row-click="abrir($event.data)"
      >
        <template #empty>
          <div class="vacio"><i class="pi pi-check-circle" /> No hay vencimientos con estos filtros.</div>
        </template>

        <Column field="codigo" header="ID" sortable style="width: 9rem">
          <template #body="{ data }">
            <RouterLink :to="{ name: 'requerimiento-detalle', params: { id: data.id } }" class="id" @click.stop>
              {{ data.codigo }}
            </RouterLink>
          </template>
        </Column>
        <Column field="nombre" header="Requerimiento" sortable>
          <template #body="{ data }">
            <span class="nombre" :title="data.nombre">{{ data.nombre || "Sin nombre" }}</span>
          </template>
        </Column>
        <Column field="responsable" header="Responsable" sortable style="width: 12rem">
          <template #body="{ data }"><span class="corta" :title="data.responsable">{{ data.responsable || "—" }}</span></template>
        </Column>
        <Column field="estado" header="Estado" sortable style="width: 11rem">
          <template #body="{ data }"><span class="corta" :title="data.estado">{{ data.estado || "—" }}</span></template>
        </Column>
        <Column field="categoria" header="Categoría" sortable style="width: 7rem" />
        <Column header="Fuente" style="width: 7rem">
          <template #body="{ data }"><FuenteBadge :fuentes="data.fuentes" compacto /></template>
        </Column>
        <Column field="fechaInicio" header="Inicio" sortable style="width: 6.5rem">
          <template #body="{ data }">{{ formatearFecha(data.fechaInicio) || "—" }}</template>
        </Column>
        <Column field="fechaFin" header="Fin" sortable style="width: 6.5rem">
          <template #body="{ data }">{{ formatearFecha(data.fechaFin) }}</template>
        </Column>
        <Column field="diasRestantes" header="Días restantes" sortable style="width: 9rem">
          <template #body="{ data }">
            <span :class="{ atraso: data.diasRestantes < 0 }">{{ textoDias(data.diasRestantes) }}</span>
          </template>
        </Column>
        <Column header="Riesgo" style="width: 9rem">
          <template #body="{ data }"><EstadoTemporalTag :estado="data.estadoTemporal" /></template>
        </Column>
      </DataTable>

      <div v-if="pestana === 'sin'" class="sin-plan">
        <div class="problemas">
          <span class="problemas-titulo">Problema detectado</span>
          <button
              v-for="opcion in opcionesProblema"
              :key="opcion.valor"
              type="button"
              class="chip"
              :class="{ activo: problemasElegidos.includes(opcion.valor) }"
              @click="problemasElegidos = problemasElegidos.includes(opcion.valor) ? problemasElegidos.filter(tipo => tipo !== opcion.valor) : [...problemasElegidos, opcion.valor]"
          >
            {{ opcion.etiqueta }}
          </button>
        </div>

        <DataTable
            :value="filasSinPlan"
            :loading="cargando && !cargado"
            data-key="id"
            scrollable
            scroll-height="flex"
            paginator
            :rows="50"
            :rows-per-page-options="[25, 50, 100]"
            paginator-template="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            current-page-report-template="{first}–{last} de {totalRecords}"
            size="small"
            row-hover
            sort-field="codigo"
            :sort-order="-1"
            class="tabla"
            @row-click="abrir($event.data)"
        >
          <template #empty>
            <div class="vacio"><i class="pi pi-check-circle" /> Todos los requerimientos activos tienen su planificación completa.</div>
          </template>

          <Column field="codigo" header="ID" sortable style="width: 9rem">
            <template #body="{ data }">
              <RouterLink :to="{ name: 'requerimiento-detalle', params: { id: data.id } }" class="id" @click.stop>
                {{ data.codigo }}
              </RouterLink>
            </template>
          </Column>
          <Column field="nombre" header="Requerimiento" sortable>
            <template #body="{ data }">
              <span class="nombre" :title="data.nombre">{{ data.nombre || "Sin nombre" }}</span>
            </template>
          </Column>
          <Column field="estado" header="Estado" sortable style="width: 11rem">
            <template #body="{ data }"><span class="corta" :title="data.estado">{{ data.estado || "—" }}</span></template>
          </Column>
          <Column field="responsable" header="Responsable" sortable style="width: 12rem">
            <template #body="{ data }"><span class="corta" :title="data.responsable">{{ data.responsable || "—" }}</span></template>
          </Column>
          <Column field="categoria" header="Categoría" sortable style="width: 7rem" />
          <Column field="fechaInicio" header="Inicio" sortable style="width: 6.5rem">
            <template #body="{ data }">{{ formatearFecha(data.fechaInicio) || "—" }}</template>
          </Column>
          <Column field="fechaFin" header="Fin" sortable style="width: 6.5rem">
            <template #body="{ data }">{{ formatearFecha(data.fechaFin) || "—" }}</template>
          </Column>
          <Column header="Problema detectado" style="width: 16rem">
            <template #body="{ data }">
              <span class="lista-problemas">
                <span v-for="problema in data.problemas" :key="problema.descripcion" class="problema" :title="problema.descripcion">
                  {{ problema.descripcion }}
                </span>
              </span>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <PlanificacionDetalle v-model:visible="detalleVisible" :item="seleccionado" />
  </section>
</template>


<style scoped>
.planificacion {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
}

.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--pi-radius-md);
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
  font-size: 12px;
}


/* Pestañas e indicadores */
.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.pestanas {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-md);
  background: var(--pi-surface);
}

.pestanas button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--pi-text-subtle);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.pestanas button i {
  font-size: 11px;
}

.pestanas button:hover {
  color: var(--pi-text);
}

.pestanas button.activa {
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
}

.contador {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--pi-surface-muted);
  color: var(--pi-text-subtle);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.activa .contador {
  background: var(--pi-surface);
  color: var(--pi-primary);
}

.kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.kpi {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-md);
  background: var(--pi-surface);
  color: var(--pi-text-subtle);
  font-size: 11px;
  cursor: pointer;
  transition: border-color var(--pi-transition);
}

.kpi:hover {
  border-color: var(--pt-color);
}

.kpi.activo {
  border-color: var(--pt-color);
  background: var(--pt-soft);
  color: var(--pi-text);
}

.kpi strong {
  color: var(--pi-text);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.marca {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--pt-color);
}

.kpi.pt-sin .marca {
  border: 1.5px dashed var(--pi-text-muted);
  background: transparent;
}


/* Filtros */
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.busqueda {
  flex: 1 1 180px;
  max-width: 250px;
}

.filtro {
  display: inline-flex;
  flex: 1 1 150px;
  align-items: center;
  min-width: 0;
  max-width: 230px;
  border: 1px solid var(--pi-border);
  border-radius: 6px;
  background: var(--pi-surface);
}

.filtro > span {
  padding: 0 4px 0 9px;
  color: var(--pi-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.filtro.activo {
  flex-grow: 2;
  max-width: 280px;
  border-color: var(--pi-primary);
  background: var(--pi-primary-soft);
}

.filtro.activo > span {
  color: var(--pi-primary);
}

.selector {
  flex: 1;
  min-width: 76px;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.selector :deep(.p-select-label) {
  padding-left: 2px;
  color: var(--pi-text);
  font-size: 12px;
}

.eventos {
  flex: 0 0 120px;
}

.eventos-titulo {
  padding: 8px 12px 4px;
  color: var(--pi-text-muted);
  font-size: 11px;
  font-weight: 600;
}

.resultado {
  margin-left: auto;
  color: var(--pi-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.resultado strong {
  color: var(--pi-text);
  font-variant-numeric: tabular-nums;
}


/* Contenido */
.panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 420px;
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.panel > .tabla,
.sin-plan {
  flex: 1;
  min-height: 0;
}

.sin-plan {
  display: flex;
  flex-direction: column;
}

.sin-plan .tabla {
  flex: 1;
  min-height: 0;
}

.problemas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--pi-border);
}

.problemas-titulo {
  margin-right: 4px;
  color: var(--pi-text-muted);
  font-size: 11px;
}

.chip {
  padding: 3px 9px;
  border: 1px solid var(--pi-border);
  border-radius: 999px;
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
  font-size: 11px;
  cursor: pointer;
}

.chip:hover {
  border-color: var(--pi-border-strong);
}

.chip.activo {
  border-color: var(--pi-primary);
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
}

.tabla :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.tabla :deep(.p-datatable-tbody > tr.seleccionada) {
  background: var(--pi-primary-soft);
}

.tabla :deep(.p-datatable-tbody > tr > td) {
  font-size: 12px;
  white-space: nowrap;
}

.tabla :deep(.p-datatable-column-title) {
  font-size: 11px;
  font-weight: 650;
}

.id {
  color: var(--pi-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 650;
}

.id:hover {
  text-decoration: underline;
}

.nombre {
  display: block;
  max-width: 460px;
  overflow: hidden;
  color: var(--pi-text);
  font-weight: 600;
  text-overflow: ellipsis;
}

.corta {
  display: block;
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.atraso {
  color: var(--pi-danger);
  font-weight: 600;
}

.lista-problemas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.problema {
  max-width: 15rem;
  padding: 1px 7px;
  overflow: hidden;
  border: 1px solid var(--pi-warning-border);
  border-radius: 999px;
  background: var(--pi-warning-soft);
  color: var(--pi-warning-text);
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.vacio {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--pi-text-muted);
  font-size: 12px;
}

@media (max-width: 1200px) {
  .resultado {
    display: none;
  }
}

@media (max-width: 900px) {
  .busqueda {
    flex-basis: 100%;
    max-width: none;
  }

  .filtro {
    max-width: none;
  }
}
</style>
