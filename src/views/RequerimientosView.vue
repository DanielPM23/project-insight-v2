<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import {
  obtenerRequerimientos
} from "../services/requerimientosService";

import type {
  FuenteRequerimiento,
  RequerimientoTabla
} from "../services/requerimientosService";

const requerimientos =
    ref<RequerimientoTabla[]>([]);

const cargando =
    ref(true);

const error =
    ref("");

const busqueda =
    ref("");

const filtroFuente =
    ref<"TODOS" | FuenteRequerimiento>("TODOS");


async function cargarRequerimientos() {
  cargando.value = true;
  error.value = "";

  try {
    requerimientos.value =
        await obtenerRequerimientos();
  } catch (e) {
    console.error(
        "Error cargando requerimientos:",
        e
    );

    error.value =
        e instanceof Error
            ? e.message
            : "No se pudieron cargar los requerimientos.";
  } finally {
    cargando.value = false;
  }
}

onMounted(cargarRequerimientos);


const total =
    computed(
        () =>
            requerimientos.value.length
    );

const totalDT =
    computed(
        () =>
            requerimientos.value
                .filter(
                    item =>
                        item.enDemandaTactica
                )
                .length
    );

const totalCQ =
    computed(
        () =>
            requerimientos.value
                .filter(
                    item =>
                        item.enClearQuest
                )
                .length
    );

const totalAmbas =
    computed(
        () =>
            requerimientos.value
                .filter(
                    item =>
                        item.enDemandaTactica &&
                        item.enClearQuest
                )
                .length
    );


const requerimientosFiltrados =
    computed(() => {
      const termino =
          busqueda.value
              .trim()
              .toLowerCase();

      return requerimientos.value
          .filter(item => {
            if (
                filtroFuente.value !== "TODOS" &&
                item.fuente !== filtroFuente.value
            ) {
              return false;
            }

            if (!termino) {
              return true;
            }

            const contenido =
                [
                  item.idDemanda,
                  item.idMantenimiento,
                  item.nombre,
                  item.estado,
                  item.responsable,
                  item.recurso,
                  item.gerencia,
                  item.aplicacion,
                  item.areaSolicitante
                ]
                    .join(" ")
                    .toLowerCase();

            return contenido.includes(
                termino
            );
          });
    });


function etiquetaFuente(
    fuente: FuenteRequerimiento
): string {
  switch (fuente) {
    case "DT_CQ":
      return "DT + CQ";

    case "DT":
      return "DT";

    case "CQ":
      return "CQ";
  }
}


function claseFuente(
    fuente: FuenteRequerimiento
): string {
  switch (fuente) {
    case "DT_CQ":
      return "source-both";

    case "DT":
      return "source-dt";

    case "CQ":
      return "source-cq";
  }
}
</script>


<template>
  <section class="requirements-page">

    <div class="page-intro">

      <div>

        <div class="eyebrow">
          <i class="pi pi-list" />
          Gestión de requerimientos
        </div>

        <h2>
          Project Insight
        </h2>

        <p>
          Vista consolidada de los requerimientos
          almacenados en Firestore.
        </p>

      </div>


      <button
          class="refresh-button"
          type="button"
          :disabled="cargando"
          @click="cargarRequerimientos"
      >
        <i
            :class="
            cargando
              ? 'pi pi-spin pi-spinner'
              : 'pi pi-refresh'
          "
        />

        Actualizar
      </button>

    </div>


    <div class="metrics-grid">

      <div class="metric-card">

        <div class="metric-icon">
          <i class="pi pi-database" />
        </div>

        <div>
          <span>Total</span>
          <strong>{{ total }}</strong>
          <small>Requerimientos registrados</small>
        </div>

      </div>


      <div class="metric-card">

        <div class="metric-icon dt">
          <i class="pi pi-table" />
        </div>

        <div>
          <span>Demanda Táctica</span>
          <strong>{{ totalDT }}</strong>
          <small>Presentes en DT</small>
        </div>

      </div>


      <div class="metric-card">

        <div class="metric-icon cq">
          <i class="pi pi-server" />
        </div>

        <div>
          <span>ClearQuest</span>
          <strong>{{ totalCQ }}</strong>
          <small>Presentes en CQ</small>
        </div>

      </div>


      <div class="metric-card">

        <div class="metric-icon both">
          <i class="pi pi-link" />
        </div>

        <div>
          <span>DT + CQ</span>
          <strong>{{ totalAmbas }}</strong>
          <small>Coincidencia por mantenimiento</small>
        </div>

      </div>

    </div>


    <div class="table-card">

      <div class="table-toolbar">

        <div class="search-box">

          <i class="pi pi-search" />

          <input
              v-model="busqueda"
              type="search"
              placeholder="Buscar por ID, mantenimiento, nombre, responsable..."
          />

        </div>


        <select
            v-model="filtroFuente"
            class="source-filter"
        >

          <option value="TODOS">
            Todas las fuentes
          </option>

          <option value="DT_CQ">
            DT + CQ
          </option>

          <option value="DT">
            Solo Demanda Táctica
          </option>

          <option value="CQ">
            Solo ClearQuest
          </option>

        </select>


        <div class="results-count">

          <strong>
            {{ requerimientosFiltrados.length }}
          </strong>

          <span>
            resultados
          </span>

        </div>

      </div>


      <div
          v-if="cargando"
          class="state-container"
      >

        <div class="state-icon loading">
          <i class="pi pi-spin pi-spinner" />
        </div>

        <strong>
          Cargando Project Insight...
        </strong>

        <span>
          Consultando los requerimientos en Firestore.
        </span>

      </div>


      <div
          v-else-if="error"
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


      <div
          v-else-if="
          requerimientosFiltrados.length === 0
        "
          class="state-container"
      >

        <div class="state-icon">
          <i class="pi pi-search" />
        </div>

        <strong>
          No se encontraron requerimientos
        </strong>

        <span>
          Prueba con otro término de búsqueda
          o cambia el filtro de fuente.
        </span>

      </div>


      <div
          v-else
          class="table-wrapper"
      >

        <table>

          <thead>

          <tr>
            <th>ID Mantenimiento</th>
            <th>ID Demanda</th>
            <th class="requirement-column">
              Requerimiento
            </th>
            <th>Fuente</th>
            <th>Estado</th>
            <th>Responsable / Analista</th>
            <th>Recurso</th>
            <th>Aplicación</th>
          </tr>

          </thead>


          <tbody>

          <tr
              v-for="
                item
                in requerimientosFiltrados
              "
              :key="item.idDocumento"
          >

            <td>

                <span
                    v-if="item.idMantenimiento"
                    class="id-value"
                >
                  {{ item.idMantenimiento }}
                </span>

              <span
                  v-else
                  class="empty-value"
              >
                  —
                </span>

            </td>


            <td>

                <span
                    v-if="item.idDemanda"
                    class="id-secondary"
                >
                  {{ item.idDemanda }}
                </span>

              <span
                  v-else
                  class="empty-value"
              >
                  —
                </span>

            </td>


            <td class="requirement-cell">

              <strong>
                {{
                  item.nombre ||
                  "Sin nombre"
                }}
              </strong>

              <small
                  v-if="item.gerencia"
              >
                {{ item.gerencia }}
              </small>

            </td>


            <td>

                <span
                    class="source-badge"
                    :class="
                    claseFuente(
                      item.fuente
                    )
                  "
                >
                  {{
                    etiquetaFuente(
                        item.fuente
                    )
                  }}
                </span>

            </td>


            <td>

                <span
                    v-if="item.estado"
                    class="status-badge"
                >
                  {{ item.estado }}
                </span>

              <span
                  v-else
                  class="empty-value"
              >
                  —
                </span>

            </td>


            <td>
              {{
                item.responsable ||
                "—"
              }}
            </td>


            <td>

                <span
                    v-if="item.recurso"
                    class="resource-badge"
                >
                  {{ item.recurso }}
                </span>

              <span
                  v-else
                  class="empty-value"
              >
                  —
                </span>

            </td>


            <td>
              {{
                item.aplicacion ||
                "—"
              }}
            </td>

          </tr>

          </tbody>

        </table>

      </div>

    </div>

  </section>
</template>


<style scoped>
.requirements-page {
  width: 100%;
  padding-bottom: 32px;
}

.page-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: var(--pi-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.page-intro h2 {
  margin: 0;
  color: var(--pi-text);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.page-intro p {
  margin: 5px 0 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.refresh-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 35px;
  padding: 0 12px;
  gap: 7px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.refresh-button:hover:not(:disabled) {
  background: var(--pi-surface-soft);
}

.refresh-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.metrics-grid {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.metric-card {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 15px;
  gap: 11px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--pi-surface-muted);
  color: var(--pi-text-secondary);
}

.metric-icon.dt {
  background: #eff6ff;
  color: #2563eb;
}

.metric-icon.cq {
  background: #f5f3ff;
  color: #7c3aed;
}

.metric-icon.both {
  background: #ecfdf5;
  color: #16a34a;
}

.metric-icon i {
  font-size: 13px;
}

.metric-card span {
  display: block;
  color: var(--pi-text-muted);
  font-size: 9px;
  font-weight: 600;
}

.metric-card strong {
  display: block;
  margin-top: 3px;
  color: var(--pi-text);
  font-size: 20px;
  font-weight: 700;
}

.metric-card small {
  display: block;
  margin-top: 2px;
  color: var(--pi-text-muted);
  font-size: 8px;
}

.table-card {
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--pi-border);
}

.search-box {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 260px;
  max-width: 600px;
  height: 36px;
  padding: 0 11px;
  gap: 8px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface-soft);
}

.search-box:focus-within {
  border-color: #93c5fd;
  background: #ffffff;
  box-shadow:
      0 0 0 3px
      rgba(37, 99, 235, 0.07);
}

.search-box i {
  color: var(--pi-text-muted);
  font-size: 11px;
}

.search-box input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--pi-text-secondary);
  font-size: 10px;
}

.source-filter {
  height: 36px;
  min-width: 170px;
  padding: 0 30px 0 10px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
  font-size: 10px;
  outline: none;
}

.results-count {
  display: flex;
  align-items: baseline;
  margin-left: auto;
  gap: 4px;
  white-space: nowrap;
}

.results-count strong {
  color: var(--pi-text);
  font-size: 11px;
}

.results-count span {
  color: var(--pi-text-muted);
  font-size: 9px;
}

.table-wrapper {
  width: 100%;
  max-height: calc(100vh - 330px);
  overflow: auto;
}

table {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
}

th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 10px 12px;
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
  padding: 10px 12px;
  border-bottom: 1px solid #edf2f7;
  color: var(--pi-text-secondary);
  font-size: 9px;
  vertical-align: middle;
}

tbody tr {
  transition:
      background
      var(--pi-transition);
}

tbody tr:hover {
  background: #fafcff;
}

.requirement-column {
  min-width: 270px;
}

.requirement-cell {
  max-width: 360px;
}

.requirement-cell strong {
  display: block;
  overflow: hidden;
  color: var(--pi-text);
  font-size: 9px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requirement-cell small {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--pi-text-muted);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id-value {
  color: var(--pi-primary);
  font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  font-size: 8px;
  font-weight: 700;
  white-space: nowrap;
}

.id-secondary {
  color: var(--pi-text-secondary);
  font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  font-size: 8px;
  white-space: nowrap;
}

.empty-value {
  color: #cbd5e1;
}

.source-badge,
.status-badge,
.resource-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 7px;
  border-radius: 999px;
  font-size: 8px;
  font-weight: 650;
  white-space: nowrap;
}

.source-dt {
  background: #eff6ff;
  color: #2563eb;
}

.source-cq {
  background: #f5f3ff;
  color: #7c3aed;
}

.source-both {
  background: #ecfdf5;
  color: #16a34a;
}

.status-badge {
  background: var(--pi-surface-muted);
  color: var(--pi-text-secondary);
}

.resource-badge {
  background: #fff7ed;
  color: #c2410c;
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

@media (max-width: 1050px) {
  .metrics-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .table-toolbar {
    flex-wrap: wrap;
  }

  .results-count {
    margin-left: 0;
  }
}

@media (max-width: 650px) {
  .page-intro {
    flex-direction: column;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .search-box {
    min-width: 100%;
    max-width: none;
  }

  .source-filter {
    flex: 1;
  }
}
</style>
