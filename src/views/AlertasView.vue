<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import SelectButton from "primevue/selectbutton";
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
import { formatearFecha } from "../utils/fechas";


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

const filtros = ref<Filtro[]>(["VENCIDO", "VENCE_HOY", "PROXIMO"]);

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

const filas = computed(() =>
    alertas.value.filter(alerta =>
        filtros.value.length === 0 ||
        (alerta.nivel !== null && filtros.value.includes(alerta.nivel)) ||
        (alerta.fechaModificada !== null && filtros.value.includes("MODIFICADA"))
    )
);

function soloNivel(nivel: Filtro) {
  filtros.value = [nivel];
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
            aria-label="Filtrar alertas"
        />

        <RouterLink v-if="auth.esAdmin" :to="{ name: 'configuracion' }" class="cambiar-dias">
          <i class="pi pi-cog" /> Cambiar los días
        </RouterLink>
      </div>

      <DataTable
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
.modificada .icono { background: #f5f3ff; color: #7c3aed; }

.texto span {
  display: block;
  color: #64748b;
  font-size: 11px;
}

.texto strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.texto small {
  display: block;
  margin-top: 4px;
  color: #94a3b8;
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
}
</style>
