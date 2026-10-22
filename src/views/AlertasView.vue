<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import SelectButton from "primevue/selectbutton";
import MultiSelect from "primevue/multiselect";
import DatePicker from "primevue/datepicker";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import Button from "primevue/button";

import AlertaTag from "../components/alertas/AlertaTag.vue";

import {
  NIVELES_ALERTA,
  textoDias
} from "../services/alertasService";

import type {
  AlertaDesarrollo,
  NivelAlerta
} from "../services/alertasService";

import { useAlertasStore } from "../stores/alertasStore";
import { useAuthStore } from "../stores/authStore";
import { aDiaCalendario, formatearFecha } from "../utils/fechas";
import { descargarCSV } from "../utils/csv";
import type { ColumnaCSV } from "../utils/csv";


const router = useRouter();
const store = useAlertasStore();
const auth = useAuthStore();

const {
  alertas,
  conteo,
  configuracion,
  cargando,
  error
} = storeToRefs(store);

onMounted(() => store.cargar());


type Filtro = NivelAlerta | "MODIFICADA";

const FILTROS_POR_DEFECTO: Filtro[] = ["VENCIDO", "VENCE_HOY", "PROXIMO"];

const filtros = ref<Filtro[]>([...FILTROS_POR_DEFECTO]);
const busqueda = ref("");
const filtroEstado = ref<string[]>([]);
const filtroResponsable = ref<string[]>([]);
const rangoFin = ref<(Date | null)[] | null>(null);

const opciones = computed(() => [
  ...(Object.keys(NIVELES_ALERTA) as NivelAlerta[]).map(nivel => ({
    valor: nivel as Filtro,
    etiqueta: `${NIVELES_ALERTA[nivel].nombre} (${conteo.value[nivel]})`
  })),
  {
    valor: "MODIFICADA" as Filtro,
    etiqueta: `Fecha modificada (${conteo.value.MODIFICADA})`
  }
]);

const tarjetas = computed(() => [
  { nivel: "VENCIDO", titulo: "Vencidos", valor: conteo.value.VENCIDO, detalle: "Fecha pasada y desarrollo sin terminar", icono: "pi pi-times-circle", clase: "vencido" },
  { nivel: "VENCE_HOY", titulo: "Vencen hoy", valor: conteo.value.VENCE_HOY, detalle: formatearFecha(new Date()), icono: "pi pi-exclamation-circle", clase: "hoy" },
  { nivel: "PROXIMO", titulo: "Próximos a vencer", valor: conteo.value.PROXIMO, detalle: `En los próximos ${configuracion.value.diasAnticipacion} días`, icono: "pi pi-clock", clase: "proximo" },
  { nivel: "MODIFICADA", titulo: "Fecha modificada", valor: conteo.value.MODIFICADA, detalle: `En los últimos ${configuracion.value.diasFechaModificada} días`, icono: "pi pi-calendar-clock", clase: "modificada" }
] as const);


function cumpleTipo(alerta: AlertaDesarrollo): boolean {
  return filtros.value.length === 0 ||
      (alerta.nivel !== null && filtros.value.includes(alerta.nivel)) ||
      (alerta.fechaModificada !== null && filtros.value.includes("MODIFICADA"));
}


/*
 * Estados y responsables de las alertas del tipo elegido,
 * con cuántas tiene cada uno.
 */
function opcionesDe(campo: "estado" | "responsable") {
  const cantidad = new Map<string, number>();

  for (const alerta of alertas.value) {
    if (alerta[campo] && cumpleTipo(alerta)) {
      cantidad.set(alerta[campo], (cantidad.get(alerta[campo]) ?? 0) + 1);
    }
  }

  return Array.from(cantidad)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .map(([valor, total]) => ({ valor, etiqueta: `${valor} (${total})` }));
}

const opcionesEstado = computed(() => opcionesDe("estado"));
const opcionesResponsable = computed(() => opcionesDe("responsable"));

const filas = computed(() => {
  const termino = busqueda.value.trim().toLowerCase();
  const desde = aDiaCalendario(rangoFin.value?.[0] ?? null);
  const hasta = aDiaCalendario(rangoFin.value?.[1] ?? null) ?? desde;

  return alertas.value.filter(alerta =>
      cumpleTipo(alerta) &&
      (filtroEstado.value.length === 0 || filtroEstado.value.includes(alerta.estado)) &&
      (filtroResponsable.value.length === 0 || filtroResponsable.value.includes(alerta.responsable)) &&
      (!desde || alerta.fechaFin >= desde) &&
      (!hasta || alerta.fechaFin <= hasta) &&
      (!termino || [alerta.idMantenimiento, alerta.idTramite, alerta.nombre, alerta.responsable, alerta.estado]
          .some(texto => texto?.toLowerCase().includes(termino)))
  );
});

const cantidadFiltros = computed(() =>
    (filtros.value.length !== FILTROS_POR_DEFECTO.length || !FILTROS_POR_DEFECTO.every(filtro => filtros.value.includes(filtro)) ? 1 : 0) +
    (busqueda.value.trim() ? 1 : 0) +
    (filtroEstado.value.length > 0 ? 1 : 0) +
    (filtroResponsable.value.length > 0 ? 1 : 0) +
    (rangoFin.value?.[0] ? 1 : 0)
);

function limpiarFiltros() {
  filtros.value = [...FILTROS_POR_DEFECTO];
  busqueda.value = "";
  filtroEstado.value = [];
  filtroResponsable.value = [];
  rangoFin.value = null;
}

/*
 * Un clic en la tarjeta deja solo ese tipo; otro clic en
 * la misma tarjeta vuelve a la vista por defecto.
 */
function soloNivel(nivel: Filtro) {
  filtros.value = filtros.value.length === 1 && filtros.value[0] === nivel
      ? [...FILTROS_POR_DEFECTO]
      : [nivel];
}


// =========================================================
// CSV
// =========================================================

/*
 * El CSV lleva las filas filtradas en el mismo orden que
 * la tabla.
 */
const campoOrden = ref<string | undefined>();
const sentidoOrden = ref<number | undefined>();

function filasOrdenadas(): AlertaDesarrollo[] {
  const campo = campoOrden.value as keyof AlertaDesarrollo | undefined;
  const sentido = sentidoOrden.value ?? 1;

  if (!campo) {
    return filas.value;
  }

  return [...filas.value].sort((a, b) => {
    const x = a[campo];
    const y = b[campo];

    if (x == null || y == null) {
      return x == null ? (y == null ? 0 : 1) : -1;
    }

    const resultado = typeof x === "string" && typeof y === "string"
        ? x.localeCompare(y, "es", { numeric: true })
        : Number(x) - Number(y);

    return resultado * sentido;
  });
}

const COLUMNAS_CSV: ColumnaCSV<AlertaDesarrollo>[] = [
  { titulo: "Alerta", valor: a => (a.nivel ? NIVELES_ALERTA[a.nivel].nombre : "Desarrollo terminado") },
  { titulo: "Fecha modificada", valor: a => (a.fechaModificada ? "Sí" : "No") },
  { titulo: "Fin de desarrollo anterior", valor: a => formatearFecha(a.fechaModificada?.anterior ?? null) },
  { titulo: "Fecha de la modificación", valor: a => formatearFecha(a.fechaModificada?.fechaCarga ?? null) },
  { titulo: "ID Mantenimiento", valor: a => a.idMantenimiento },
  { titulo: "ID Trámite", valor: a => a.idTramite },
  { titulo: "Requerimiento", valor: a => a.nombre },
  { titulo: "Fin de desarrollo", valor: a => formatearFecha(a.fechaFin) },
  { titulo: "Días", valor: a => a.dias },
  { titulo: "Plazo", valor: a => (a.nivel ? textoDias(a.dias) : "Desarrollo terminado") },
  { titulo: "Estado", valor: a => a.estado },
  { titulo: "Responsable", valor: a => a.responsable }
];

function exportarCSV() {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  descargarCSV(`alertas-${fecha}`, COLUMNAS_CSV, filasOrdenadas());
}

function abrir(alerta: AlertaDesarrollo) {
  router.push({ name: "requerimiento-detalle", params: { id: alerta.idRequerimiento } });
}
</script>


<template>
  <section class="alertas-page">

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

    <div v-if="error" class="error-box" role="alert">
      <i class="pi pi-exclamation-triangle" />
      {{ error }}
    </div>

    <div class="tarjetas">
      <button
          v-for="tarjeta in tarjetas"
          :key="tarjeta.nivel"
          type="button"
          class="tarjeta"
          :class="[tarjeta.clase, { activa: filtros.length === 1 && filtros[0] === tarjeta.nivel }]"
          @click="soloNivel(tarjeta.nivel)"
      >
        <span class="icono"><i :class="tarjeta.icono" /></span>
        <span class="texto">
          <span>{{ tarjeta.titulo }}</span>
          <strong>{{ tarjeta.valor }}</strong>
          <small>{{ tarjeta.detalle }}</small>
        </span>
      </button>
    </div>

    <div class="panel">
      <div class="panel-cabecera">
        <SelectButton
            v-model="filtros"
            :options="opciones"
            option-label="etiqueta"
            option-value="valor"
            multiple
            size="small"
            class="filtros"
            aria-label="Filtrar por tipo de alerta"
        />

        <div class="acciones">
          <span class="conteo" aria-live="polite">
            <strong>{{ filas.length }}</strong> de {{ alertas.length }} alertas
          </span>

          <RouterLink v-if="auth.esAdmin" :to="{ name: 'configuracion' }" class="cambiar-dias">
            <i class="pi pi-cog" /> Cambiar los días
          </RouterLink>

          <Button
              v-tooltip.bottom="'Descargar la tabla filtrada en CSV'"
              icon="pi pi-download"
              label="CSV"
              severity="secondary"
              outlined
              size="small"
              :disabled="filas.length === 0"
              @click="exportarCSV"
          />
        </div>
      </div>

      <!-- Filtros combinables: se aplican todos a la vez. -->
      <div class="fila-filtros">
        <IconField class="busqueda">
          <InputIcon class="pi pi-search" />
          <InputText
              v-model="busqueda"
              type="search"
              size="small"
              placeholder="Buscar por ID, nombre, responsable..."
              aria-label="Buscar alertas"
              fluid
          />
        </IconField>

        <MultiSelect
            v-model="filtroEstado"
            :options="opcionesEstado"
            option-label="etiqueta"
            option-value="valor"
            placeholder="Estado"
            selected-items-label="Estado ({0})"
            :max-selected-labels="1"
            filter
            filter-placeholder="Buscar estado"
            show-clear
            size="small"
            class="filtro"
            :class="{ activo: filtroEstado.length > 0 }"
            aria-label="Filtrar por estado"
        />

        <MultiSelect
            v-model="filtroResponsable"
            :options="opcionesResponsable"
            option-label="etiqueta"
            option-value="valor"
            placeholder="Responsable"
            selected-items-label="Responsable ({0})"
            :max-selected-labels="1"
            filter
            filter-placeholder="Buscar responsable"
            show-clear
            size="small"
            class="filtro"
            :class="{ activo: filtroResponsable.length > 0 }"
            aria-label="Filtrar por responsable"
        />

        <DatePicker
            v-model="rangoFin"
            selection-mode="range"
            :manual-input="false"
            date-format="dd/mm/yy"
            placeholder="Fin de desarrollo"
            show-button-bar
            show-icon
            icon-display="input"
            size="small"
            class="filtro filtro-fecha"
            :class="{ activo: !!rangoFin?.[0] }"
            aria-label="Filtrar por rango de fin de desarrollo"
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

      <DataTable
          v-model:sort-field="campoOrden"
          v-model:sort-order="sentidoOrden"
          :value="filas"
          :loading="cargando"
          data-key="idRequerimiento"
          paginator
          :rows="25"
          :rows-per-page-options="[25, 50, 100]"
          paginator-template="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          current-page-report-template="{first}–{last} de {totalRecords}"
          size="small"
          row-hover
          striped-rows
          class="tabla"
          @row-click="abrir($event.data)"
      >
        <template #empty>
          <div class="vacio">
            <i class="pi pi-check-circle" />
            No hay alertas con estos filtros.
          </div>
        </template>

        <Column header="Alerta" style="width: 11rem">
          <template #body="{ data }">
            <AlertaTag :alerta="data" />
          </template>
        </Column>

        <Column field="idMantenimiento" header="Mantenimiento" sortable style="width: 9rem">
          <template #body="{ data }">
            <span class="id">{{ data.idMantenimiento || data.idTramite || "—" }}</span>
          </template>
        </Column>

        <Column field="nombre" header="Requerimiento" sortable>
          <template #body="{ data }">
            <span class="nombre" :title="data.nombre">{{ data.nombre || "Sin nombre" }}</span>
          </template>
        </Column>

        <Column field="fechaFin" header="Fin de desarrollo" sortable style="width: 9rem">
          <template #body="{ data }">{{ formatearFecha(data.fechaFin) }}</template>
        </Column>

        <Column field="dias" header="Plazo" sortable style="width: 10rem">
          <template #body="{ data }">
            <span :class="{ atraso: data.dias < 0 && data.nivel }">
              {{ data.nivel ? textoDias(data.dias) : "Desarrollo terminado" }}
            </span>
          </template>
        </Column>

        <Column field="estado" header="Estado" sortable style="width: 11rem">
          <template #body="{ data }">
            <span class="celda-corta" :title="data.estado">{{ data.estado }}</span>
          </template>
        </Column>

        <Column field="responsable" header="Responsable" sortable style="width: 13rem">
          <template #body="{ data }">
            <span class="celda-corta" :title="data.responsable">{{ data.responsable }}</span>
          </template>
        </Column>

        <Column style="width: 3rem">
          <template #body="{ data }">
            <RouterLink
                v-tooltip.left="'Ver en planificación'"
                :to="{ name: 'planificacion', query: { id: data.idRequerimiento } }"
                class="ver-planificacion"
                aria-label="Ver en planificación"
                @click.stop
            >
              <i class="pi pi-calendar" />
            </RouterLink>
          </template>
        </Column>
      </DataTable>
    </div>

  </section>
</template>


<style scoped>
.alertas-page {
  width: 100%;
  padding-bottom: 32px;
}

.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border-radius: var(--pi-radius-md);
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
  font-size: 12px;
}

.tarjetas {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.tarjeta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: var(--pi-surface);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--pi-transition);
}

.tarjeta:hover,
.tarjeta.activa {
  border-color: var(--pi-primary);
}

.icono {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
}

.vencido .icono { background: var(--pi-danger-soft); color: var(--pi-danger); }
.hoy .icono { background: var(--pi-warning-soft); color: var(--pi-warning); }
.proximo .icono { background: var(--pi-primary-soft); color: var(--pi-primary); }
.modificada .icono { background: var(--pi-purple-soft); color: var(--pi-purple); }

.texto span {
  display: block;
  color: var(--pi-text-subtle);
  font-size: 11px;
}

.texto strong {
  display: block;
  margin-top: 4px;
  color: var(--pi-text);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.texto small {
  display: block;
  margin-top: 4px;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.panel {
  padding: 16px 18px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.panel-cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.acciones {
  display: flex;
  align-items: center;
  gap: 12px;
}

.conteo {
  color: var(--pi-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.conteo strong {
  color: var(--pi-text);
  font-variant-numeric: tabular-nums;
}

.fila-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.busqueda {
  flex: 1 1 240px;
  max-width: 320px;
}

.filtro {
  flex: 1 1 150px;
  min-width: 140px;
  max-width: 190px;
}

.filtro-fecha {
  max-width: 220px;
}

.filtro.activo,
.filtro.activo :deep(.p-inputtext) {
  border-color: var(--pi-primary);
  background: var(--pi-primary-soft);
}

.cambiar-dias {
  color: var(--pi-primary);
  font-size: 11px;
  text-decoration: none;
}

.tabla :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.tabla :deep(.p-datatable-tbody > tr > td) {
  font-size: 12px;
  white-space: nowrap;
}

.celda-corta {
  display: block;
  max-width: 13rem;
  overflow: hidden;
  text-overflow: ellipsis;
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

.nombre {
  display: block;
  max-width: 420px;
  overflow: hidden;
  color: var(--pi-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ver-planificacion {
  display: inline-flex;
  padding: 4px;
  border-radius: 6px;
  color: var(--pi-text-muted);
}

.ver-planificacion:hover {
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
}

.atraso {
  color: var(--pi-danger);
  font-weight: 600;
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

@media (max-width: 1050px) {
  .tarjetas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .tarjetas {
    grid-template-columns: 1fr;
  }

  .busqueda,
  .filtro {
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>
