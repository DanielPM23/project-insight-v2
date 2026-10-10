<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { storeToRefs } from "pinia";

import AlertaTag from "./AlertaTag.vue";
import { textoDias } from "../../services/alertasService";
import { useAlertasStore } from "../../stores/alertasStore";
import { formatearFecha } from "../../utils/fechas";


/*
 * Bloque de alertas del Dashboard: conteo por nivel y los
 * vencimientos más urgentes.
 */
const store = useAlertasStore();
const { conteo, pendientes, configuracion, cargando } = storeToRefs(store);

const niveles = computed(() => [
  { clave: "VENCIDO", titulo: "Vencidos", valor: conteo.value.VENCIDO, clase: "vencido", icono: "pi pi-times-circle" },
  { clave: "VENCE_HOY", titulo: "Vencen hoy", valor: conteo.value.VENCE_HOY, clase: "hoy", icono: "pi pi-exclamation-circle" },
  { clave: "PROXIMO", titulo: `Próximos ${configuracion.value.diasAnticipacion} días`, valor: conteo.value.PROXIMO, clase: "proximo", icono: "pi pi-clock" },
  { clave: "MODIFICADA", titulo: "Fecha modificada", valor: conteo.value.MODIFICADA, clase: "modificada", icono: "pi pi-calendar-clock" }
]);
</script>


<template>
  <div class="panel">
    <div class="cabecera">
      <div>
        <h3>Alertas de desarrollo</h3>
        <p>Según la fecha de Fin Desarrollo de Demanda Táctica.</p>
      </div>
      <RouterLink :to="{ name: 'alertas' }" class="ver-todas">
        Ver todas <i class="pi pi-arrow-right" />
      </RouterLink>
    </div>

    <div class="niveles">
      <RouterLink
          v-for="nivel in niveles"
          :key="nivel.clave"
          :to="{ name: 'requerimientos', query: { alerta: nivel.clave } }"
          class="nivel"
          :class="nivel.clase"
      >
        <i :class="nivel.icono" />
        <strong>{{ cargando && !pendientes.length ? "…" : nivel.valor }}</strong>
        <span>{{ nivel.titulo }}</span>
      </RouterLink>
    </div>

    <p v-if="!cargando && pendientes.length === 0" class="vacio">
      <i class="pi pi-check-circle" /> No hay desarrollos vencidos ni por vencer.
    </p>

    <ul v-else class="lista">
      <li v-for="alerta in pendientes.slice(0, 6)" :key="alerta.idRequerimiento">
        <RouterLink :to="{ name: 'requerimiento-detalle', params: { id: alerta.idRequerimiento } }">
          <span class="id">{{ alerta.idMantenimiento || alerta.idTramite }}</span>
          <span class="nombre" :title="alerta.nombre">{{ alerta.nombre }}</span>
          <span class="fecha">{{ formatearFecha(alerta.fechaFin) }}</span>
          <span class="dias" :class="{ atraso: alerta.dias < 0 }">{{ textoDias(alerta.dias) }}</span>
          <AlertaTag :alerta="alerta" />
        </RouterLink>
      </li>
    </ul>
  </div>
</template>


<style scoped>
.panel {
  padding: 18px 20px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

h3 {
  margin: 0;
  color: var(--pi-text);
  font-size: 13px;
  font-weight: 650;
}

.cabecera p {
  margin: 3px 0 0;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.ver-todas {
  color: var(--pi-primary);
  font-size: 11px;
  text-decoration: none;
  white-space: nowrap;
}

.niveles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0 10px;
}

.nivel {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 8px;
  padding: 10px 12px;
  border-radius: var(--pi-radius-md);
  text-decoration: none;
}

.nivel i {
  grid-row: span 2;
  font-size: 16px;
}

.nivel strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.nivel span {
  font-size: 10px;
}

.vencido { background: var(--pi-danger-soft); color: var(--pi-danger); }
.hoy { background: var(--pi-warning-soft); color: var(--pi-warning); }
.proximo { background: var(--pi-primary-soft); color: var(--pi-primary); }
.modificada { background: #f5f3ff; color: #7c3aed; }

.vacio {
  margin: 8px 0 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.lista {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista a {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 80px 120px auto;
  align-items: center;
  gap: 10px;
  padding: 7px 6px;
  border-radius: 6px;
  color: inherit;
  font-size: 11px;
  text-decoration: none;
}

.lista a:hover {
  background: var(--pi-surface-soft);
}

.id {
  color: var(--pi-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 650;
}

.nombre {
  overflow: hidden;
  color: var(--pi-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fecha {
  color: var(--pi-text-secondary);
  font-variant-numeric: tabular-nums;
}

.dias {
  color: var(--pi-text-secondary);
}

.dias.atraso {
  color: var(--pi-danger);
  font-weight: 600;
}

@media (max-width: 800px) {
  .niveles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lista a {
    grid-template-columns: 80px minmax(0, 1fr) auto;
  }

  .fecha,
  .dias {
    display: none;
  }
}
</style>
