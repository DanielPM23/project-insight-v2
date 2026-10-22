<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import FullCalendar from "@fullcalendar/vue3";
import dayGridPlugin from "@fullcalendar/daygrid";
import esLocale from "@fullcalendar/core/locales/es";
import type { CalendarOptions, DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";

import Button from "primevue/button";
import SelectButton from "primevue/selectbutton";

import EventoCalendario from "./EventoCalendario.vue";

import {
  ESTADOS_TEMPORALES,
  TIPOS_EVENTO,
  estadoDelEvento,
  fechaISO
} from "../../services/planificacionService";

import type { RangoFechas } from "../../services/planificacionService";
import type { EstadoTemporal, PlanificacionEvento } from "../../models/Planificacion";
import { formatearFecha } from "../../utils/fechas";
import { textoDias } from "../../services/alertasService";


/*
 * Calendario de Planificación (FullCalendar, vista de días
 * por mes o por semana). La barra de navegación es propia
 * para que siga el estilo de Project Insight.
 */
export type VistaCalendario = "mes" | "semana";

const props = defineProps<{
  eventos: PlanificacionEvento[];
  fechaInicial: Date;
}>();

const vista = defineModel<VistaCalendario>("vista", { required: true });

const emit = defineEmits<{
  seleccionar: [evento: PlanificacionEvento];
  rango: [rango: RangoFechas];
}>();


const VISTAS: Record<VistaCalendario, string> = {
  mes: "dayGridMonth",
  semana: "dayGridWeek"
};

const OPCIONES_VISTA = [
  { valor: "mes", nombre: "Mes" },
  { valor: "semana", nombre: "Semana" }
];

const LEYENDA: EstadoTemporal[] = ["VENCIDO", "VENCE_HOY", "PROXIMO", "EN_PLAZO", "FINALIZADO", "INFORMATIVO"];

const calendario = ref<InstanceType<typeof FullCalendar> | null>(null);
const titulo = ref("");

function api() {
  return calendario.value?.getApi();
}


/*
 * "Octubre 2026" o "19 – 25 oct 2026".
 */
function tituloDe(inicio: Date, fin: Date): string {
  if (vista.value === "mes") {
    const texto = inicio.toLocaleDateString("es-PE", { month: "long", year: "numeric" }).replace(" de ", " ");
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  const ultimo = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - 1);
  const mes = (fecha: Date) => fecha.toLocaleDateString("es-PE", { month: "short" }).replace(".", "");

  return inicio.getMonth() === ultimo.getMonth()
      ? `${inicio.getDate()} – ${ultimo.getDate()} ${mes(ultimo)} ${ultimo.getFullYear()}`
      : `${inicio.getDate()} ${mes(inicio)} – ${ultimo.getDate()} ${mes(ultimo)} ${ultimo.getFullYear()}`;
}

function alCambiarFechas(arg: DatesSetArg) {
  titulo.value = tituloDe(arg.view.currentStart, arg.view.currentEnd);
  emit("rango", { desde: arg.view.activeStart, hasta: arg.view.activeEnd });
}

function alHacerClic(arg: EventClickArg) {
  arg.jsEvent.preventDefault();
  emit("seleccionar", arg.event.extendedProps.evento as PlanificacionEvento);
}


const eventosCalendario = computed<EventInput[]>(() =>
    props.eventos.map(evento => {
      const estado = estadoDelEvento(evento);

      return {
        id: evento.id,
        title: evento.requerimiento.codigo,
        start: fechaISO(evento.fecha),
        allDay: true,
        classNames: ["pl-evento", ESTADOS_TEMPORALES[estado].clase],
        orden: ESTADOS_TEMPORALES[evento.requerimiento.estadoTemporal].orden,
        extendedProps: { evento }
      };
    })
);

const opciones = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin],
  locale: esLocale,
  initialView: VISTAS[vista.value],
  initialDate: fechaISO(props.fechaInicial),
  headerToolbar: false,
  firstDay: 1,
  height: "100%",
  fixedWeekCount: false,
  dayMaxEvents: true,
  views: {
    dayGridWeek: { dayMaxEvents: false }
  },
  eventOrder: "orden,title",
  eventDisplay: "block",
  events: eventosCalendario.value,
  datesSet: alCambiarFechas,
  eventClick: alHacerClic
}));

watch(vista, valor => api()?.changeView(VISTAS[valor]));


function detalle(evento: PlanificacionEvento): string {
  const item = evento.requerimiento;

  return [
    `${item.codigo} · ${TIPOS_EVENTO[evento.tipo].nombre}`,
    item.nombre,
    `Responsable: ${item.responsable || "—"}`,
    `Inicio: ${formatearFecha(item.fechaInicio) || "—"} · Fin: ${formatearFecha(item.fechaFin) || "—"}`,
    item.diasRestantes !== null && !item.terminado ? textoDias(item.diasRestantes) : ESTADOS_TEMPORALES[item.estadoTemporal].nombre
  ].join("\n");
}

/*
 * FullCalendar solo escucha la ventana: se ajusta también
 * al mostrar la pestaña, abrir el menú o el panel lateral.
 */
const contenedor = ref<HTMLElement | null>(null);
let observador: ResizeObserver | null = null;

onMounted(() => {
  observador = new ResizeObserver(() => api()?.updateSize());

  if (contenedor.value) {
    observador.observe(contenedor.value);
  }
});

onBeforeUnmount(() => observador?.disconnect());

function irA(fecha: Date) {
  api()?.gotoDate(fechaISO(fecha));
}

defineExpose({ irA });
</script>


<template>
  <div class="calendario">
    <div class="barra">
      <div class="navegacion">
        <Button label="Hoy" severity="secondary" outlined size="small" @click="api()?.today()" />
        <Button icon="pi pi-chevron-left" severity="secondary" text rounded size="small" aria-label="Anterior" @click="api()?.prev()" />
        <strong class="titulo">{{ titulo }}</strong>
        <Button icon="pi pi-chevron-right" severity="secondary" text rounded size="small" aria-label="Siguiente" @click="api()?.next()" />
      </div>

      <div class="leyenda" aria-label="Leyenda de estados">
        <span v-for="estado in LEYENDA" :key="estado" :class="ESTADOS_TEMPORALES[estado].clase">
          <i class="punto" /> {{ ESTADOS_TEMPORALES[estado].nombre }}
        </span>
      </div>

      <SelectButton
          v-model="vista"
          :options="OPCIONES_VISTA"
          option-label="nombre"
          option-value="valor"
          :allow-empty="false"
          size="small"
          aria-label="Vista del calendario"
      />
    </div>

    <div ref="contenedor" class="contenedor">
      <FullCalendar ref="calendario" :options="opciones">
        <template #eventContent="{ event }">
          <EventoCalendario
              v-tooltip.top="detalle(event.extendedProps.evento)"
              :evento="event.extendedProps.evento"
              :con-nombre="vista === 'semana'"
          />
        </template>
      </FullCalendar>
    </div>
  </div>
</template>


<style scoped>
.calendario {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 14px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--pi-border);
}

.navegacion {
  display: flex;
  align-items: center;
  gap: 2px;
}

.navegacion > :first-child {
  margin-right: 6px;
}

.titulo {
  min-width: 150px;
  color: var(--pi-text);
  font-size: 14px;
  font-weight: 650;
  text-align: center;
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  color: var(--pi-text-subtle);
  font-size: 10px;
}

.leyenda span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.punto {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--pt-color);
}

.contenedor {
  flex: 1;
  min-height: 0;
  padding: 0 0 2px;
}


/* FullCalendar con las variables de Project Insight (claro y oscuro). */
.contenedor :deep(.fc) {
  --fc-border-color: var(--pi-border);
  --fc-page-bg-color: var(--pi-surface);
  --fc-neutral-bg-color: var(--pi-surface-soft);
  --fc-today-bg-color: var(--pi-primary-soft);
  --fc-event-bg-color: transparent;
  --fc-event-border-color: transparent;
  --fc-event-text-color: var(--pi-text);
  --fc-small-font-size: 11px;
  height: 100%;
  font-size: 12px;
}

.contenedor :deep(.fc-scrollgrid) {
  border-right: 0;
  border-left: 0;
}

.contenedor :deep(.fc-col-header-cell) {
  padding: 5px 0;
  background: var(--pi-surface-soft);
  color: var(--pi-text-subtle);
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
}

.contenedor :deep(.fc-col-header-cell-cushion),
.contenedor :deep(.fc-daygrid-day-number) {
  color: inherit;
  text-decoration: none;
}

.contenedor :deep(.fc-daygrid-day-number) {
  padding: 3px 6px;
  color: var(--pi-text-subtle);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.contenedor :deep(.fc-day-today .fc-daygrid-day-number) {
  margin: 2px 4px 0 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--pi-primary);
  color: #fff;
  font-weight: 650;
}

.contenedor :deep(.fc-day-sat),
.contenedor :deep(.fc-day-sun) {
  background: var(--pi-surface-soft);
}

.contenedor :deep(.fc-day-other .fc-daygrid-day-top) {
  opacity: 0.45;
}

.contenedor :deep(.fc-daygrid-more-link) {
  margin-left: 4px;
  color: var(--pi-primary);
  font-size: 10px;
  font-weight: 600;
}

.contenedor :deep(.fc-popover) {
  border-color: var(--pi-border);
  border-radius: var(--pi-radius-md);
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
}

.contenedor :deep(.fc-popover-header) {
  background: var(--pi-surface-soft);
  color: var(--pi-text);
  font-size: 11px;
  font-weight: 600;
}

.contenedor :deep(.fc-popover-body) {
  max-height: 320px;
  overflow-y: auto;
}

.contenedor :deep(.pl-evento) {
  margin: 1px 4px 2px !important;
  padding: 0;
  border: 1px solid var(--pt-border);
  border-left: 3px solid var(--pt-color);
  border-radius: 4px;
  background: var(--pt-soft);
  cursor: pointer;
}

.contenedor :deep(.pl-evento:hover) {
  border-color: var(--pt-color);
}

.contenedor :deep(.pl-evento.pt-info),
.contenedor :deep(.pl-evento.pt-finalizado) {
  background: var(--pi-surface);
}

@media (max-width: 1100px) {
  .leyenda {
    display: none;
  }
}
</style>
