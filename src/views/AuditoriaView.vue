<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import AutoComplete from "primevue/autocomplete";
import Button from "primevue/button";

import HistorialCargas from "../components/auditoria/HistorialCargas.vue";
import CambiosTabla from "../components/auditoria/CambiosTabla.vue";
import type { FilaCambio } from "../components/auditoria/CambiosTabla.vue";
import LineaTiempoCambios from "../components/auditoria/LineaTiempoCambios.vue";

import {
  listarCambiosDeCarga,
  listarCambiosDeRegistros,
  listarCargas,
  obtenerCargas
} from "../services/auditoriaService";

import type {
  CambioRegistro,
  Carga
} from "../services/auditoriaService";

import type { Requerimiento } from "../services/requerimientosService";
import { useRequerimientosStore } from "../stores/requerimientosStore";
import { formatearFechaHora } from "../utils/fechas";
import { FUENTES } from "../config/sourceSchemas";


const route = useRoute();
const router = useRouter();
const requerimientosStore = useRequerimientosStore();

const pestana = ref<"cargas" | "requerimiento">("cargas");
const error = ref("");


// =========================================================
// CARGAS
// =========================================================

const cargas = ref<Carga[]>([]);
const cargandoCargas = ref(false);
const cargaSeleccionada = ref<Carga | null>(null);
const cambiosCarga = ref<CambioRegistro[]>([]);
const cargandoCambios = ref(false);

async function cargarCargas() {
  cargandoCargas.value = true;
  error.value = "";

  try {
    cargas.value = await listarCargas(100);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "No se pudo leer el historial de cargas.";
  } finally {
    cargandoCargas.value = false;
  }
}

async function seleccionarCarga(carga: Carga) {
  cargaSeleccionada.value = carga;
  cambiosCarga.value = [];

  if (route.query.carga !== carga.id) {
    router.replace({ query: { ...route.query, carga: carga.id, req: undefined } });
  }

  if (carga.tipo === "BASELINE") {
    return;
  }

  cargandoCambios.value = true;

  try {
    cambiosCarga.value = await listarCambiosDeCarga(carga.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "No se pudieron leer los cambios de la carga.";
  } finally {
    cargandoCambios.value = false;
  }
}

function aFila(cambio: CambioRegistro): FilaCambio {
  return {
    id: cambio.id,
    tipo: cambio.tipo,
    codigoFuente: cambio.codigoFuente,
    idDocumento: cambio.idDocumento,
    idPrincipal: [cambio.clave, cambio.idMantenimiento || cambio.idTramite].filter(Boolean).join(" · "),
    nombre: cambio.nombre,
    campos: cambio.campos
  };
}

const filasCarga = computed(() => cambiosCarga.value.map(aFila));


// =========================================================
// POR REQUERIMIENTO
// =========================================================

const busqueda = ref<Requerimiento | string | null>(null);
const sugerencias = ref<Requerimiento[]>([]);
const requerimiento = ref<Requerimiento | null>(null);
const historial = ref<CambioRegistro[]>([]);
const cargandoHistorial = ref(false);

function etiquetaRequerimiento(item: Requerimiento): string {
  const id = item.idMantenimiento || item.idTramite || item.idDemanda || item.caso || item.id;

  return `${id} · ${item.nombre || "Sin nombre"}`;
}

function buscar(evento: { query: string }) {
  const termino = evento.query.trim().toLowerCase();

  sugerencias.value = requerimientosStore.requerimientos
      .filter(item =>
          [item.idMantenimiento, item.idTramite, item.idDemanda, item.caso, item.nombre]
              .join(" ")
              .toLowerCase()
              .includes(termino)
      )
      .slice(0, 20);
}

/*
 * Todas las filas de las fuentes que forman el
 * requerimiento (DT, casos del Listado y actividades CQ).
 */
function documentosDe(item: Requerimiento): string[] {
  return [
    item.demandaTactica?.idDocumento,
    ...item.listado.map(registro => registro.idDocumento),
    ...item.clearQuest.map(registro => registro.idDocumento)
  ].filter((id): id is string => !!id);
}

async function verRequerimiento(item: Requerimiento) {
  requerimiento.value = item;
  busqueda.value = item;
  historial.value = [];
  cargandoHistorial.value = true;

  if (route.query.req !== item.id) {
    router.replace({ query: { ...route.query, req: item.id, carga: undefined } });
  }

  try {
    historial.value = await listarCambiosDeRegistros(documentosDe(item));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "No se pudo leer el historial del requerimiento.";
  } finally {
    cargandoHistorial.value = false;
  }
}


// =========================================================
// INICIO
// =========================================================

async function aplicarQuery() {
  const idCarga = typeof route.query.carga === "string" ? route.query.carga : "";
  const idReq = typeof route.query.req === "string" ? route.query.req : "";

  if (idReq) {
    pestana.value = "requerimiento";
    await requerimientosStore.cargar();

    const item = requerimientosStore.porId.get(idReq);

    if (item && item.id !== requerimiento.value?.id) {
      await verRequerimiento(item);
    }
  } else if (idCarga && idCarga !== cargaSeleccionada.value?.id) {
    pestana.value = "cargas";

    const carga =
        cargas.value.find(item => item.id === idCarga) ??
        (await obtenerCargas([idCarga]))[0];

    if (carga) {
      await seleccionarCarga(carga);
    }
  }
}

onMounted(async () => {
  requerimientosStore.cargar();
  await cargarCargas();
  await aplicarQuery();
});

watch(() => route.query, aplicarQuery);
</script>


<template>
  <section class="auditoria-page">

    <Teleport defer to="#topbar-acciones">
      <Button
          label="Actualizar"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="cargandoCargas"
          @click="cargarCargas"
      />
    </Teleport>

    <div v-if="error" class="error-box" role="alert">
      <i class="pi pi-exclamation-triangle" />
      {{ error }}
    </div>

    <Tabs v-model:value="pestana" class="tabs">
      <TabList>
        <Tab value="cargas">
          <i class="pi pi-history" /> Por carga
        </Tab>
        <Tab value="requerimiento">
          <i class="pi pi-list" /> Por requerimiento
        </Tab>
      </TabList>

      <TabPanels>

        <TabPanel value="cargas">
          <div class="layout-cargas">

            <div class="panel">
              <h3>Historial de cargas</h3>
              <HistorialCargas
                  :cargas="cargas"
                  :cargando="cargandoCargas"
                  :seleccionada="cargaSeleccionada?.id ?? null"
                  @seleccionar="seleccionarCarga"
              />
            </div>

            <div class="panel">
              <template v-if="cargaSeleccionada">
                <div class="carga-cabecera">
                  <div>
                    <h3>{{ cargaSeleccionada.archivo }}</h3>
                    <p>
                      {{ FUENTES[cargaSeleccionada.fuente].nombre }} ·
                      {{ cargaSeleccionada.tipo === "BASELINE" ? "Base inicial" : "Actualización" }} ·
                      {{ formatearFechaHora(cargaSeleccionada.fecha) }}
                      <template v-if="cargaSeleccionada.usuario?.email">
                        · {{ cargaSeleccionada.usuario.email }}
                      </template>
                    </p>
                  </div>
                </div>

                <div class="resumen">
                  <div><strong>{{ cargaSeleccionada.total }}</strong><span>En el archivo</span></div>
                  <div class="nuevo"><strong>{{ cargaSeleccionada.nuevos }}</strong><span>Nuevos</span></div>
                  <div class="modificado"><strong>{{ cargaSeleccionada.modificados }}</strong><span>Modificados</span></div>
                  <div class="reactivado"><strong>{{ cargaSeleccionada.reactivados }}</strong><span>Reactivados</span></div>
                  <div><strong>{{ cargaSeleccionada.sinCambios }}</strong><span>Sin cambios</span></div>
                  <div class="inactivo"><strong>{{ cargaSeleccionada.inactivos }}</strong><span>Inactivados</span></div>
                </div>

                <p v-if="cargaSeleccionada.tipo === 'BASELINE'" class="nota">
                  Es la base inicial de la fuente: todos sus registros entraron como nuevos.
                  El detalle por registro se guarda desde la primera actualización.
                </p>

                <CambiosTabla
                    v-else
                    :filas="filasCarga"
                    :cargando="cargandoCambios"
                />
              </template>

              <div v-else class="placeholder">
                <i class="pi pi-arrow-left" />
                Elige una carga para ver qué registros cambiaron.
              </div>
            </div>

          </div>
        </TabPanel>

        <TabPanel value="requerimiento">
          <div class="panel">
            <AutoComplete
                v-model="busqueda"
                :suggestions="sugerencias"
                :option-label="etiquetaRequerimiento"
                placeholder="Busca por mantenimiento, trámite, ID de demanda, caso o nombre"
                fluid
                :delay="150"
                class="buscador"
                @complete="buscar"
                @option-select="verRequerimiento($event.value)"
            />

            <template v-if="requerimiento">
              <div class="req-cabecera">
                <div>
                  <h3>{{ requerimiento.nombre || "Sin nombre" }}</h3>
                  <p>
                    {{ [requerimiento.idMantenimiento, requerimiento.idTramite].filter(Boolean).join(" · ") }}
                    · {{ requerimiento.fuentes.join(" + ") }}
                  </p>
                </div>
                <RouterLink
                    :to="{ name: 'requerimiento-detalle', params: { id: requerimiento.id } }"
                    class="ver-detalle"
                >
                  Ver detalle <i class="pi pi-arrow-right" />
                </RouterLink>
              </div>

              <LineaTiempoCambios
                  :cambios="historial"
                  :cargando="cargandoHistorial"
              />
            </template>

            <div v-else class="placeholder">
              <i class="pi pi-search" />
              Busca un requerimiento para ver todos sus cambios, de todas sus fuentes.
            </div>
          </div>
        </TabPanel>

      </TabPanels>
    </Tabs>

  </section>
</template>


<style scoped>
.auditoria-page {
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

.tabs :deep(.p-tablist) {
  background: transparent;
}

.tabs :deep(.p-tab) {
  display: flex;
  gap: 7px;
  font-size: 13px;
}

.tabs :deep(.p-tabpanels) {
  padding: 14px 0 0;
  background: transparent;
}

.layout-cargas {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 16px;
  align-items: start;
}

.panel {
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.panel h3 {
  margin: 0 0 12px;
  color: var(--pi-text);
  font-size: 14px;
  font-weight: 650;
}

.carga-cabecera h3,
.req-cabecera h3 {
  margin-bottom: 2px;
  word-break: break-word;
}

.carga-cabecera p,
.req-cabecera p {
  margin: 0 0 12px;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.resumen div {
  padding: 8px 10px;
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface-soft);
}

.resumen strong {
  display: block;
  color: var(--pi-text);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}

.resumen span {
  color: var(--pi-text-muted);
  font-size: 10px;
}

.resumen .nuevo strong { color: var(--pi-success); }
.resumen .modificado strong { color: var(--pi-primary); }
.resumen .reactivado strong { color: var(--pi-warning); }
.resumen .inactivo strong { color: var(--pi-text-secondary); }

.nota {
  margin: 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 200px;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.buscador {
  margin-bottom: 16px;
}

.req-cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ver-detalle {
  flex-shrink: 0;
  color: var(--pi-primary);
  font-size: 12px;
  text-decoration: none;
}

@media (max-width: 1200px) {
  .layout-cargas {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .resumen {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
