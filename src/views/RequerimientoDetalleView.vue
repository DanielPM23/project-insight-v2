<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch
} from "vue";

import {
  storeToRefs
} from "pinia";

import {
  useRequerimientosStore
} from "../stores/requerimientosStore";

import {
  FUENTES
} from "../config/sourceSchemas";

import type {
  CodigoFuente
} from "../config/sourceSchemas";

import type {
  RegistroFuente
} from "../services/registrosFuente";


const props =
    defineProps<{
      id: string;
    }>();


const store =
    useRequerimientosStore();

const {
  cargando,
  error,
  porId,
  requerimientos
} = storeToRefs(store);


onMounted(
    () => store.cargar()
);


const requerimiento =
    computed(() =>
        porId.value.get(props.id) ?? null
    );


/*
 * Otros requerimientos con el mismo mantenimiento
 * (por ejemplo 2026-M0013 con 4 trámites).
 */
const relacionados =
    computed(() => {
      const actual =
          requerimiento.value;

      if (!actual?.idMantenimiento) {
        return [];
      }

      return requerimientos.value.filter(
          item =>
              item.id !== actual.id &&
              item.idMantenimiento === actual.idMantenimiento
      );
    });


// =========================================================
// PESTAÑAS
// =========================================================

const pestanas =
    computed(() => {
      const actual =
          requerimiento.value;

      if (!actual) {
        return [];
      }

      return [
        {
          codigo: "DT" as CodigoFuente,
          titulo: "Demanda Táctica",
          cantidad: actual.demandaTactica ? 1 : 0
        },
        {
          codigo: "LS" as CodigoFuente,
          titulo: "Listado",
          cantidad: actual.listado.length
        },
        {
          codigo: "CQ" as CodigoFuente,
          titulo: "ClearQuest",
          cantidad: actual.clearQuest.length
        }
      ];
    });


const pestanaActiva =
    ref<CodigoFuente>("DT");


watch(
    requerimiento,
    actual => {
      if (actual) {
        pestanaActiva.value =
            actual.fuentes[0] ?? "DT";
      }
    },
    {
      immediate: true
    }
);


const actividadAbierta =
    ref("");


function alternarActividad(
    idDocumento: string
) {
  actividadAbierta.value =
      actividadAbierta.value === idDocumento
          ? ""
          : idDocumento;
}


const actividadesOrdenadas =
    computed(() =>
        [...(requerimiento.value?.clearQuest ?? [])]
            .sort((a, b) =>
                texto(a.datos.id_mantenimiento)
                    .localeCompare(
                        texto(b.datos.id_mantenimiento),
                        "es",
                        { numeric: true }
                    )
            )
    );


// =========================================================
// CAMPOS
// =========================================================

interface CampoVista {
  clave: string;
  etiqueta: string;
  valor: string;
  adicional: boolean;
}


function texto(
    valor: unknown
): string {
  return valor === null || valor === undefined
      ? ""
      : String(valor).trim();
}


function formatearValor(
    valor: unknown
): string {
  if (
      valor === null ||
      valor === undefined ||
      valor === ""
  ) {
    return "";
  }

  const fecha =
      valor instanceof Date
          ? valor
          : typeof (valor as { toDate?: unknown }).toDate === "function"
              ? (valor as { toDate: () => Date }).toDate()
              : null;

  if (fecha) {
    const conHora =
        fecha.getHours() !== 0 ||
        fecha.getMinutes() !== 0;

    return conHora
        ? fecha.toLocaleString("es-PE")
        : fecha.toLocaleDateString("es-PE");
  }

  if (typeof valor === "object") {
    return JSON.stringify(valor);
  }

  return String(valor);
}


/*
 * Todos los campos de una fila: primero los del esquema
 * (con el nombre de la columna del Excel) y luego las
 * columnas adicionales, tal como vienen.
 */
function camposRegistro(
    registro: RegistroFuente
): CampoVista[] {
  const esquema =
      FUENTES[registro.fuente].campos;

  const campos: CampoVista[] = [];

  for (const [clave, configuracion] of Object.entries(esquema)) {
    if (!(clave in registro.datos)) {
      continue;
    }

    campos.push({
      clave,
      etiqueta:
          configuracion.aliases[0] ?? clave,
      valor:
          formatearValor(registro.datos[clave]),
      adicional:
          false
    });
  }

  for (const [columna, valor] of Object.entries(registro.extra)) {
    campos.push({
      clave:
          `extra:${columna}`,
      etiqueta:
          columna,
      valor:
          formatearValor(valor),
      adicional:
          true
    });
  }

  return campos;
}


function claseFuente(
    fuente: CodigoFuente
): string {
  return `source-${fuente.toLowerCase()}`;
}
</script>


<template>
  <section class="detail-page">

    <RouterLink
        :to="{ name: 'requerimientos' }"
        class="back-link"
    >
      <i class="pi pi-arrow-left" />
      Volver a requerimientos
    </RouterLink>


    <div
        v-if="cargando && !requerimiento"
        class="state-container"
    >
      <div class="state-icon loading">
        <i class="pi pi-spin pi-spinner" />
      </div>
      <strong>Cargando requerimiento...</strong>
    </div>

    <div
        v-else-if="error"
        class="state-container"
    >
      <div class="state-icon error">
        <i class="pi pi-exclamation-triangle" />
      </div>
      <strong>No se pudo cargar la información</strong>
      <span>{{ error }}</span>
    </div>

    <div
        v-else-if="!requerimiento"
        class="state-container"
    >
      <div class="state-icon">
        <i class="pi pi-search" />
      </div>
      <strong>No se encontró el requerimiento</strong>
      <span>Puede que ya no esté activo en ninguna fuente.</span>
    </div>


    <template v-else>

      <div class="detail-header">

        <div class="header-ids">
          <span
              v-if="requerimiento.idMantenimiento"
              class="id-chip primary"
          >
            {{ requerimiento.idMantenimiento }}
          </span>
          <span
              v-if="requerimiento.idTramite"
              class="id-chip"
          >
            {{ requerimiento.idTramite }}
          </span>
          <span
              v-if="requerimiento.idDemanda"
              class="id-chip"
          >
            ID Demanda {{ requerimiento.idDemanda }}
          </span>
          <span
              v-if="requerimiento.caso"
              class="id-chip"
          >
            {{ requerimiento.caso }}
          </span>
        </div>

        <h2>
          {{ requerimiento.nombre || "Sin nombre" }}
        </h2>

        <div class="header-meta">
          <span
              v-for="fuente in requerimiento.fuentes"
              :key="fuente"
              class="source-badge"
              :class="claseFuente(fuente)"
          >
            {{ fuente }}
          </span>

          <span
              v-if="requerimiento.estado"
              class="status-badge"
          >
            {{ requerimiento.estado }}
          </span>

          <span v-if="requerimiento.responsable">
            <i class="pi pi-user" />
            {{ requerimiento.responsable }}
          </span>

          <span v-if="requerimiento.aplicacion">
            <i class="pi pi-desktop" />
            {{ requerimiento.aplicacion }}
          </span>

          <span v-if="requerimiento.gerencia">
            <i class="pi pi-building" />
            {{ requerimiento.gerencia }}
          </span>
        </div>

      </div>


      <div
          v-if="requerimiento.alertas.length > 0"
          class="alert-box"
          role="alert"
      >
        <i class="pi pi-exclamation-triangle" />
        <div>
          <strong>Diferencias entre fuentes</strong>
          <p
              v-for="alerta in requerimiento.alertas"
              :key="alerta"
          >
            {{ alerta }}
          </p>
        </div>
      </div>


      <div
          v-if="relacionados.length > 0"
          class="related-box"
      >
        <strong>
          Comparten el mantenimiento {{ requerimiento.idMantenimiento }}
        </strong>
        <RouterLink
            v-for="item in relacionados"
            :key="item.id"
            :to="{ name: 'requerimiento-detalle', params: { id: item.id } }"
            class="related-link"
        >
          <span class="id-secondary">{{ item.idTramite || item.id }}</span>
          {{ item.nombre }}
        </RouterLink>
      </div>


      <div class="panel">

        <div
            class="tabs"
            role="tablist"
        >
          <button
              v-for="pestana in pestanas"
              :key="pestana.codigo"
              type="button"
              role="tab"
              class="tab"
              :class="{ active: pestanaActiva === pestana.codigo }"
              :aria-selected="pestanaActiva === pestana.codigo"
              :disabled="pestana.cantidad === 0"
              @click="pestanaActiva = pestana.codigo"
          >
            <span
                class="tab-dot"
                :class="claseFuente(pestana.codigo)"
            />
            {{ pestana.titulo }}
            <span class="tab-count">{{ pestana.cantidad }}</span>
          </button>
        </div>


        <!-- DEMANDA TÁCTICA -->

        <div
            v-if="pestanaActiva === 'DT' && requerimiento.demandaTactica"
            class="tab-body"
        >
          <dl class="fields-grid">
            <div
                v-for="campo in camposRegistro(requerimiento.demandaTactica)"
                :key="campo.clave"
                class="field"
                :class="{ extra: campo.adicional }"
            >
              <dt>{{ campo.etiqueta }}</dt>
              <dd>{{ campo.valor || "—" }}</dd>
            </div>
          </dl>
        </div>


        <!-- LISTADO -->

        <div
            v-else-if="pestanaActiva === 'LS'"
            class="tab-body"
        >
          <div
              v-for="caso in requerimiento.listado"
              :key="caso.idDocumento"
              class="record-block"
          >
            <h4>{{ caso.clave }}</h4>

            <dl class="fields-grid">
              <div
                  v-for="campo in camposRegistro(caso)"
                  :key="campo.clave"
                  class="field"
                  :class="{ extra: campo.adicional }"
              >
                <dt>{{ campo.etiqueta }}</dt>
                <dd>{{ campo.valor || "—" }}</dd>
              </div>
            </dl>
          </div>
        </div>


        <!-- CLEARQUEST -->

        <div
            v-else-if="pestanaActiva === 'CQ'"
            class="tab-body"
        >
          <p class="hint">
            {{ actividadesOrdenadas.length }} actividad(es) de ClearQuest.
            Selecciona una para ver todos sus campos.
          </p>

          <div class="table-wrapper">
            <table>
              <thead>
              <tr>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Resumen</th>
                <th>Responsable</th>
                <th>Inicio plan</th>
                <th>Fin plan</th>
                <th>Fin ejecución</th>
              </tr>
              </thead>

              <tbody>
              <template
                  v-for="actividad in actividadesOrdenadas"
                  :key="actividad.idDocumento"
              >
                <tr
                    class="clickable-row"
                    :class="{ open: actividadAbierta === actividad.idDocumento }"
                    tabindex="0"
                    @click="alternarActividad(actividad.idDocumento)"
                    @keydown.enter="alternarActividad(actividad.idDocumento)"
                >
                  <td class="id-value">{{ texto(actividad.datos.id_mantenimiento) }}</td>
                  <td><span class="status-badge">{{ actividad.estado || "—" }}</span></td>
                  <td>{{ actividad.nombre || "—" }}</td>
                  <td>{{ texto(actividad.datos.analista_cq) || "—" }}</td>
                  <td>{{ formatearValor(actividad.datos.fecha_inicio_plan_cq) || "—" }}</td>
                  <td>{{ formatearValor(actividad.datos.fecha_final_plan_cq) || "—" }}</td>
                  <td>{{ formatearValor(actividad.datos.fecha_final_ejec_cq) || "—" }}</td>
                </tr>

                <tr
                    v-if="actividadAbierta === actividad.idDocumento"
                    class="expanded-row"
                >
                  <td colspan="7">
                    <dl class="fields-grid">
                      <div
                          v-for="campo in camposRegistro(actividad)"
                          :key="campo.clave"
                          class="field"
                          :class="{ extra: campo.adicional }"
                      >
                        <dt>{{ campo.etiqueta }}</dt>
                        <dd>{{ campo.valor || "—" }}</dd>
                      </div>
                    </dl>
                  </td>
                </tr>
              </template>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </template>

  </section>
</template>


<style scoped>
.detail-page {
  width: 100%;
  padding-bottom: 32px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  color: var(--pi-text-secondary);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
}

.back-link:hover {
  color: var(--pi-primary);
}

.detail-header {
  margin-bottom: 16px;
}

.header-ids {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.id-chip {
  padding: 3px 8px;
  border: 1px solid var(--pi-border);
  border-radius: 999px;
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
}

.id-chip.primary {
  border-color: #bfdbfe;
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
}

.detail-header h2 {
  margin: 0;
  color: var(--pi-text);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  color: var(--pi-text-secondary);
  font-size: 11px;
}

.header-meta i {
  margin-right: 3px;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.source-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 650;
  white-space: nowrap;
}

.status-badge {
  background: var(--pi-surface-muted);
  color: var(--pi-text-secondary);
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

.alert-box,
.related-box {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: var(--pi-radius-md);
  font-size: 11px;
}

.alert-box {
  border: 1px solid #fde68a;
  background: var(--pi-warning-soft);
  color: #92400e;
}

.alert-box p {
  margin: 4px 0 0;
}

.related-box {
  flex-direction: column;
  border: 1px solid var(--pi-border);
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
}

.related-link {
  display: flex;
  gap: 8px;
  color: var(--pi-text);
  text-decoration: none;
}

.related-link:hover {
  color: var(--pi-primary);
}

.panel {
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 8px 10px 0;
  border-bottom: 1px solid var(--pi-border);
  overflow-x: auto;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--pi-text-secondary);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.tab.active {
  border-bottom-color: var(--pi-primary);
  color: var(--pi-text);
}

.tab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tab-dot.source-dt {
  background: #2563eb;
}

.tab-dot.source-cq {
  background: #7c3aed;
}

.tab-dot.source-ls {
  background: #c2410c;
}

.tab-count {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--pi-surface-muted);
  color: var(--pi-text-muted);
  font-size: 9px;
}

.tab-body {
  padding: 16px;
}

.record-block + .record-block {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--pi-border);
}

.record-block h4 {
  margin: 0 0 10px;
  color: var(--pi-text);
  font-size: 12px;
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px 18px;
  margin: 0;
}

.field {
  min-width: 0;
}

.field dt {
  color: var(--pi-text-muted);
  font-size: 9px;
  font-weight: 600;
}

.field.extra dt {
  font-style: italic;
}

.field dd {
  margin: 2px 0 0;
  color: var(--pi-text);
  font-size: 11px;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.hint {
  margin: 0 0 10px;
  color: var(--pi-text-muted);
  font-size: 10px;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

th {
  padding: 9px 10px;
  border-bottom: 1px solid var(--pi-border);
  background: var(--pi-surface-soft);
  color: var(--pi-text-muted);
  text-align: left;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  white-space: nowrap;
}

td {
  padding: 9px 10px;
  border-bottom: 1px solid #edf2f7;
  color: var(--pi-text-secondary);
  font-size: 10px;
  vertical-align: top;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover,
.clickable-row.open {
  background: #fafcff;
}

.expanded-row td {
  background: var(--pi-surface-soft);
}

.id-value,
.id-secondary {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  white-space: nowrap;
}

.id-value {
  color: var(--pi-primary);
  font-weight: 700;
}

.id-secondary {
  color: var(--pi-text-secondary);
}

.state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: 320px;
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

.state-icon.loading {
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
}

.state-icon.error {
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
}

.state-container strong {
  color: var(--pi-text);
  font-size: 11px;
}

.state-container span {
  max-width: 420px;
  margin-top: 4px;
  color: var(--pi-text-muted);
  font-size: 9px;
}
</style>
