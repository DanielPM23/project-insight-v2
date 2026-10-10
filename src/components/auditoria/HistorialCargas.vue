<script setup lang="ts">
import { computed, ref } from "vue";

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import SelectButton from "primevue/selectbutton";
import Tag from "primevue/tag";

import type { Carga } from "../../services/auditoriaService";
import type { CodigoFuente } from "../../config/sourceSchemas";
import { formatearFechaHora } from "../../utils/fechas";


/*
 * Archivos cargados, por fuente, con lo que cambió en
 * cada uno. Al elegir una carga se emite "seleccionar".
 */
const props = withDefaults(
    defineProps<{
      cargas: Carga[];
      cargando?: boolean;
      seleccionada?: string | null;
      filasPorPagina?: number;
    }>(),
    {
      cargando: false,
      seleccionada: null,
      filasPorPagina: 10
    }
);

const emit = defineEmits<{
  seleccionar: [carga: Carga];
}>();

const FUENTES: { codigo: CodigoFuente | "TODAS"; nombre: string }[] = [
  { codigo: "TODAS", nombre: "Todas" },
  { codigo: "DT", nombre: "Demanda Táctica" },
  { codigo: "CQ", nombre: "ClearQuest" },
  { codigo: "LS", nombre: "Listado" }
];

const fuente = ref<CodigoFuente | "TODAS">("TODAS");

const filas = computed(() =>
    fuente.value === "TODAS"
        ? props.cargas
        : props.cargas.filter(carga => carga.codigoFuente === fuente.value)
);

function claseFila(carga: Carga) {
  return carga.id === props.seleccionada ? "fila-seleccionada" : "";
}
</script>


<template>
  <div class="historial">

    <SelectButton
        v-model="fuente"
        :options="FUENTES"
        option-label="nombre"
        option-value="codigo"
        :allow-empty="false"
        size="small"
        class="fuentes"
        aria-label="Filtrar por fuente"
    />

    <DataTable
        :value="filas"
        :loading="cargando"
        data-key="id"
        paginator
        :rows="filasPorPagina"
        paginator-template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        current-page-report-template="{first}–{last} de {totalRecords}"
        size="small"
        row-hover
        :row-class="claseFila"
        class="tabla"
        @row-click="emit('seleccionar', $event.data)"
    >
      <template #empty>
        <div class="vacio">Todavía no hay cargas registradas.</div>
      </template>

      <Column field="fecha" header="Fecha" sortable style="width: 9.5rem">
        <template #body="{ data }">
          {{ formatearFechaHora(data.fecha) || "—" }}
        </template>
      </Column>

      <Column field="codigoFuente" header="Fuente" sortable style="width: 5rem">
        <template #body="{ data }">
          <span class="fuente" :class="`source-${data.codigoFuente.toLowerCase()}`">{{ data.codigoFuente }}</span>
        </template>
      </Column>

      <Column field="archivo" header="Archivo">
        <template #body="{ data }">
          <div class="archivo" :title="data.archivo">{{ data.archivo }}</div>
          <small class="detalle">
            {{ data.tipo === "BASELINE" ? "Base inicial" : "Actualización" }}
            <template v-if="data.usuario?.email"> · {{ data.usuario.email }}</template>
          </small>
        </template>
      </Column>

      <Column header="Resultado">
        <template #body="{ data }">
          <div class="conteos">
            <span v-if="data.nuevos" class="conteo nuevo" title="Nuevos">+{{ data.nuevos }}</span>
            <span v-if="data.modificados" class="conteo modificado" title="Modificados">
              <i class="pi pi-pencil" /> {{ data.modificados }}
            </span>
            <span v-if="data.reactivados" class="conteo reactivado" title="Reactivados">
              <i class="pi pi-replay" /> {{ data.reactivados }}
            </span>
            <span v-if="data.inactivos" class="conteo inactivo" title="Inactivados">−{{ data.inactivos }}</span>
            <span v-if="data.sinCambios" class="conteo igual" title="Sin cambios">= {{ data.sinCambios }}</span>
          </div>
        </template>
      </Column>

      <Column field="estado" header="Estado" style="width: 7rem">
        <template #body="{ data }">
          <Tag
              :value="data.estado === 'COMPLETADA' ? 'Completada' : data.estado === 'EN_PROCESO' ? 'Incompleta' : data.estado"
              :severity="data.estado === 'COMPLETADA' ? 'success' : 'warn'"
              class="tag"
          />
        </template>
      </Column>
    </DataTable>

  </div>
</template>


<style scoped>
.fuentes {
  margin-bottom: 10px;
}

.tabla :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.tabla :deep(.p-datatable-tbody > tr > td) {
  font-size: 12px;
}

.tabla :deep(.p-datatable-column-title) {
  font-size: 11px;
  font-weight: 650;
}

.tabla :deep(.fila-seleccionada > td) {
  background: var(--pi-primary-soft) !important;
}

.fuente {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.source-dt { background: #eff6ff; color: #2563eb; }
.source-cq { background: #f5f3ff; color: #7c3aed; }
.source-ls { background: #fff7ed; color: #c2410c; }

.archivo {
  max-width: 280px;
  overflow: hidden;
  color: var(--pi-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detalle {
  color: var(--pi-text-muted);
  font-size: 10px;
}

.conteos {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.conteo {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.conteo i {
  font-size: 9px;
}

.conteo.nuevo { background: var(--pi-success-soft); color: var(--pi-success); }
.conteo.modificado { background: var(--pi-primary-soft); color: var(--pi-primary); }
.conteo.reactivado { background: var(--pi-warning-soft); color: var(--pi-warning); }
.conteo.inactivo { background: var(--pi-surface-muted); color: var(--pi-text-secondary); }
.conteo.igual { color: var(--pi-text-muted); }

.tag {
  font-size: 10px;
}

.vacio {
  padding: 24px;
  color: var(--pi-text-muted);
  font-size: 12px;
  text-align: center;
}
</style>
