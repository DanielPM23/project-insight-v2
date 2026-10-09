<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  obtenerRequerimientos
} from "../services/requerimientosService";
import type {
  Requerimiento
} from "../services/requerimientosService";
import type {
  CodigoFuente
} from "../config/sourceSchemas";


const requerimientos =
    ref<Requerimiento[]>([]);

const cargando =
    ref(true);

const error =
    ref("");

const busqueda =
    ref("");


const FUENTES_FILTRO: {
  codigo: CodigoFuente;
  nombre: string;
}[] = [
  { codigo: "DT", nombre: "Demanda Táctica" },
  { codigo: "CQ", nombre: "ClearQuest" },
  { codigo: "LS", nombre: "Listado" }
];


/*
 * Se muestran los requerimientos presentes en
 * al menos una de las fuentes seleccionadas.
 */
const fuentesSeleccionadas =
    ref<CodigoFuente[]>(
        FUENTES_FILTRO.map(
            fuente =>
                fuente.codigo
        )
    );


function alternarFuente(
    codigo: CodigoFuente
) {
  const seleccion =
      fuentesSeleccionadas.value;

  fuentesSeleccionadas.value =
      seleccion.includes(codigo)
          ? seleccion.filter(item => item !== codigo)
          : [...seleccion, codigo];
}


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


function totalFuente(
    codigo: CodigoFuente
): number {
  return requerimientos.value
      .filter(
          item =>
              item.fuentes.includes(codigo)
      )
      .length;
}


const totalDT =
    computed(() => totalFuente("DT"));

const totalCQ =
    computed(() => totalFuente("CQ"));

const totalLS =
    computed(() => totalFuente("LS"));

const totalTres =
    computed(
        () =>
            requerimientos.value
                .filter(
                    item =>
                        item.fuentes.length === 3
                )
                .length
    );


const requerimientosFiltrados =
    computed(() => {
      const termino =
          busqueda.value
              .trim()
              .toLowerCase();

      const seleccion =
          fuentesSeleccionadas.value;

      return requerimientos.value
          .filter(item => {
            if (
                !item.fuentes.some(
                    fuente =>
                        seleccion.includes(fuente)
                )
            ) {
              return false;
            }

            if (!termino) {
              return true;
            }

            const contenido =
                [
                  item.idMantenimiento,
                  item.idTramite,
                  item.idDemanda,
                  item.caso,
                  item.nombre,
                  item.estado,
                  item.responsable,
                  item.aplicacion
                ]
                    .join(" ")
                    .toLowerCase();

            return contenido.includes(
                termino
            );
          });
    });


function claseFuente(
    fuente: CodigoFuente
): string {
  switch (fuente) {
    case "DT":
      return "source-dt";
    case "CQ":
      return "source-cq";
    case "LS":
      return "source-ls";
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

        <div class="metric-icon ls">
          <i class="pi pi-list" />
        </div>

        <div>
          <span>Listado</span>
          <strong>{{ totalLS }}</strong>
          <small>Presentes en Listado</small>
        </div>

      </div>


      <div class="metric-card">

        <div class="metric-icon both">
          <i class="pi pi-link" />
        </div>

        <div>
          <span>En las 3 fuentes</span>
          <strong>{{ totalTres }}</strong>
          <small>DT + Listado + ClearQuest</small>
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


        <div
            class="source-filter"
            role="group"
            aria-label="Filtrar por fuente"
        >

          <button
              v-for="fuente in FUENTES_FILTRO"
              :key="fuente.codigo"
              type="button"
              class="source-chip"
              :class="[
                claseFuente(fuente.codigo),
                {
                  inactive:
                    !fuentesSeleccionadas.includes(
                      fuente.codigo
                    )
                }
              ]"
              :aria-pressed="
                fuentesSeleccionadas.includes(
                  fuente.codigo
                )
              "
              @click="alternarFuente(fuente.codigo)"
          >
            {{ fuente.nombre }}
          </button>

        </div>


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
          o selecciona otra fuente.
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

            <th>ID Trámite</th>

            <th>ID Demanda / Caso</th>

            <th class="requirement-column">
              Requerimiento
            </th>

            <th>Fuentes</th>

            <th>Estado</th>

            <th>Responsable / Analista</th>

            <th>Aplicación</th>

          </tr>

          </thead>


          <tbody>

          <tr
              v-for="
                item
                in requerimientosFiltrados
              "
              :key="item.id"
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
                    v-if="item.idTramite"
                    class="id-secondary"
                >
                  {{ item.idTramite }}
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
                    v-if="item.idDemanda || item.caso"
                    class="id-secondary"
                >
                  {{ item.idDemanda || item.caso }}
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
                  v-if="item.compartenMantenimiento > 0"
              >
                Comparte mantenimiento con
                {{ item.compartenMantenimiento }}
                requerimiento(s) más
              </small>

            </td>


            <td>

                <span class="source-list">
                  <span
                      v-for="fuente in item.fuentes"
                      :key="fuente"
                      class="source-badge"
                      :class="claseFuente(fuente)"
                  >
                    {{ fuente }}
                  </span>
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
    repeat(5, minmax(0, 1fr));
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

.metric-icon.ls {
  background: #fff7ed;
  color: #c2410c;
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
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-chip {
  height: 30px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
}

.source-chip.inactive {
  border-color: var(--pi-border);
  background: var(--pi-surface);
  color: var(--pi-text-muted);
}

.source-list {
  display: inline-flex;
  gap: 4px;
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
.status-badge {
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

.source-ls {
  background: #fff7ed;
  color: #c2410c;
}

.status-badge {
  background: var(--pi-surface-muted);
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
