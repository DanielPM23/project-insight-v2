<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import Drawer from "primevue/drawer";
import Button from "primevue/button";

import EstadoTemporalTag from "./EstadoTemporalTag.vue";
import FuenteBadge from "./FuenteBadge.vue";

import { TIPOS_EVENTO } from "../../services/planificacionService";
import { textoDias } from "../../services/alertasService";
import type { PlanificacionRequerimiento, TipoEvento } from "../../models/Planificacion";
import { formatearFecha } from "../../utils/fechas";


/*
 * Resumen de un requerimiento al hacer clic en un evento o
 * una fila, sin salir de Planificación.
 */
const props = defineProps<{
  item: PlanificacionRequerimiento | null;
}>();

const visible = defineModel<boolean>("visible", { required: true });

const router = useRouter();

const campos = computed(() => {
  const item = props.item;

  if (!item) {
    return [];
  }

  return [
    { nombre: "Estado", valor: item.estado },
    { nombre: "Responsable", valor: item.responsable },
    { nombre: "Categoría", valor: item.categoria },
    { nombre: "Recurso", valor: item.recurso },
    { nombre: "ID Trámite", valor: item.idTramite },
    { nombre: "ID Demanda", valor: item.idDemanda }
  ];
});

/*
 * Otras fechas de ClearQuest, si las tiene.
 */
const otrasFechas = computed(() => {
  const item = props.item;

  if (!item) {
    return [];
  }

  return (["INICIO_PLAN_CQ", "FIN_PLAN_CQ", "ASIGNACION_CQ"] as TipoEvento[])
      .map(tipo => ({ nombre: TIPOS_EVENTO[tipo].nombre, fecha: TIPOS_EVENTO[tipo].fecha(item) }))
      .filter(fecha => fecha.fecha);
});

const plazo = computed(() => {
  const item = props.item;

  if (!item || item.diasRestantes === null) return "—";
  if (item.terminado) return "Desarrollo terminado";

  return textoDias(item.diasRestantes);
});

function verCompleto() {
  if (props.item) {
    router.push({ name: "requerimiento-detalle", params: { id: props.item.id } });
  }
}
</script>


<template>
  <Drawer
      v-model:visible="visible"
      position="right"
      :modal="false"
      :dismissable="false"
      class="detalle-planificacion"
  >
    <template #header>
      <div v-if="item" class="cabecera">
        <span class="codigo">{{ item.codigo }}</span>
        <FuenteBadge :fuentes="item.fuentes" />
      </div>
    </template>

    <div v-if="item" class="cuerpo">
      <h3 class="nombre">{{ item.nombre || "Sin nombre" }}</h3>

      <div class="estado-temporal">
        <EstadoTemporalTag :estado="item.estadoTemporal" />
        <span class="plazo" :class="{ atraso: item.estadoTemporal === 'VENCIDO' }">{{ plazo }}</span>
      </div>

      <div class="fechas">
        <div>
          <span>Inicio desarrollo</span>
          <strong>{{ formatearFecha(item.fechaInicio) || "—" }}</strong>
        </div>
        <i class="pi pi-arrow-right" />
        <div>
          <span>Fin desarrollo</span>
          <strong>{{ formatearFecha(item.fechaFin) || "—" }}</strong>
        </div>
        <div>
          <span>Días restantes</span>
          <strong>{{ item.diasRestantes === null || item.terminado ? "—" : item.diasRestantes }}</strong>
        </div>
      </div>

      <dl class="campos">
        <template v-for="campo in campos" :key="campo.nombre">
          <dt>{{ campo.nombre }}</dt>
          <dd>{{ campo.valor || "—" }}</dd>
        </template>
        <dt>Fuente</dt>
        <dd>{{ item.cobertura }}</dd>
        <template v-for="fecha in otrasFechas" :key="fecha.nombre">
          <dt>{{ fecha.nombre }}</dt>
          <dd>{{ formatearFecha(fecha.fecha) }}</dd>
        </template>
      </dl>

      <div v-if="item.problemas.length" class="problemas">
        <strong><i class="pi pi-exclamation-triangle" /> Planificación incompleta</strong>
        <ul>
          <li v-for="problema in item.problemas" :key="problema.descripcion">{{ problema.descripcion }}</li>
        </ul>
      </div>
    </div>

    <template #footer>
      <Button
          label="Ver requerimiento completo"
          icon="pi pi-external-link"
          size="small"
          fluid
          :disabled="!item"
          @click="verCompleto"
      />
    </template>
  </Drawer>
</template>


<style scoped>
.cabecera {
  display: flex;
  align-items: center;
  gap: 8px;
}

.codigo {
  color: var(--pi-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  font-weight: 700;
}

.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.nombre {
  margin: 0;
  color: var(--pi-text);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.35;
}

.estado-temporal {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plazo {
  color: var(--pi-text-secondary);
  font-size: 12px;
}

.plazo.atraso {
  color: var(--pi-danger);
  font-weight: 600;
}

.fechas {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-md);
  background: var(--pi-surface-soft);
}

.fechas > div:last-child {
  padding-left: 10px;
  border-left: 1px solid var(--pi-border);
}

.fechas span {
  display: block;
  white-space: nowrap;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.fechas strong {
  display: block;
  margin-top: 2px;
  color: var(--pi-text);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.fechas i {
  color: var(--pi-text-muted);
  font-size: 11px;
}

.campos {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 7px 10px;
  margin: 0;
  font-size: 12px;
}

.campos dt {
  color: var(--pi-text-muted);
}

.campos dd {
  margin: 0;
  color: var(--pi-text);
  overflow-wrap: anywhere;
}

.problemas {
  padding: 10px 12px;
  border: 1px solid var(--pi-warning-border);
  border-radius: var(--pi-radius-md);
  background: var(--pi-warning-soft);
  color: var(--pi-warning-text);
  font-size: 12px;
}

.problemas ul {
  margin: 6px 0 0;
  padding-left: 18px;
}
</style>

<style>
/* Con el selector de PrimeVue (.p-drawer-right .p-drawer) delante para ganarle. */
.p-drawer-right .detalle-planificacion.p-drawer {
  width: 380px;
  max-width: 100vw;
  align-self: flex-end;
  height: calc(100% - var(--pi-topbar-height));
  border-left: 1px solid var(--pi-border);
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.08);
}

.p-drawer-right .detalle-planificacion .p-drawer-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--pi-border);
}

.p-drawer-right .detalle-planificacion .p-drawer-content {
  height: auto;
  min-height: 0;
  padding: 14px 16px;
}

.p-drawer-right .detalle-planificacion .p-drawer-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--pi-border);
}
</style>
