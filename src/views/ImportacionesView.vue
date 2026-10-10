<script setup lang="ts">
import CambiosTabla from "../components/auditoria/CambiosTabla.vue";
import type { FilaCambio } from "../components/auditoria/CambiosTabla.vue";
import HistorialCargas from "../components/auditoria/HistorialCargas.vue";
import { listarCargas } from "../services/auditoriaService";
import type { Carga } from "../services/auditoriaService";
import { FUENTES as FUENTES_IMPORTACION } from "../config/sourceSchemas";

import {
  computed,
  onMounted,
  ref
} from "vue";

import {
  analizarExcel
} from "../services/excelAnalyzerService";

import {
  validarRegistrosExcel
} from "../services/excelValidationService";

import {
  establecerBaseline
} from "../services/baselineService";

import {
  aplicarActualizacionFuente,
  compararConUltimaCarga,
  existeBaselineFuente
} from "../services/importUpdateService";

import type {
  ResultadoComparacionImportacion
} from "../services/importUpdateService";

import type {
  AnalisisExcel
} from "../models/ExcelAnalysis";

import {
  FUENTES,
  esFuenteConocida
} from "../config/sourceSchemas";


// =========================================================
// ESTADO
// =========================================================

const analisis =
    ref<AnalisisExcel | null>(null);

const cargando =
    ref(false);

const guardando =
    ref(false);

const baselineGuardado =
    ref(false);

const baselineExistente =
    ref(false);

const comparando =
    ref(false);

const actualizando =
    ref(false);

const actualizacionAplicada =
    ref(false);

const comparacion =
    ref<ResultadoComparacionImportacion | null>(null);

const mensajeActualizacion =
    ref("");

const arrastrando =
    ref(false);

const error =
    ref("");

const mensajeBaseline =
    ref("");

const archivoSeleccionado =
    ref<File | null>(null);

const inputArchivo =
    ref<HTMLInputElement | null>(null);


// =========================================================
// COMPUTADOS
// =========================================================

const validacion =
    computed(() => {

      if (!analisis.value) {
        return null;
      }

      return validarRegistrosExcel(
          analisis.value.registros,
          analisis.value.fuente
      );
    });


const puedeCrearBaseline =
    computed(() => {

      if (!analisis.value) {
        return false;
      }

      if (!validacion.value) {
        return false;
      }

      return (
          analisis.value.fuente !== "DESCONOCIDA" &&
          validacion.value.valido &&
          analisis.value
              .camposObligatoriosFaltantes
              .length === 0 &&
          !baselineExistente.value &&
          !guardando.value &&
          !baselineGuardado.value
      );
    });


const configuracionFuente =
    computed(() => {

      if (
          !analisis.value ||
          !esFuenteConocida(
              analisis.value.fuente
          )
      ) {
        return null;
      }

      return FUENTES[
          analisis.value.fuente
          ];
    });


const etiquetaFuente =
    computed(() =>
        configuracionFuente.value?.nombre ??
        (analisis.value ? "Fuente desconocida" : "")
    );


const claseFuente =
    computed(() => {

      if (!analisis.value) {
        return "";
      }

      return configuracionFuente.value
          ? `source-${configuracionFuente.value.codigo.toLowerCase()}`
          : "source-unknown";
    });


const analisisValido =
    computed(() => {

      if (
          !analisis.value ||
          !validacion.value
      ) {
        return false;
      }

      return (
          validacion.value.valido &&
          analisis.value
              .camposObligatoriosFaltantes
              .length === 0
      );
    });


const puedeActualizar =
    computed(() => {

      return (
          !!analisis.value &&
          !!comparacion.value &&
          baselineExistente.value &&
          analisisValido.value &&
          !actualizando.value &&
          !actualizacionAplicada.value
      );
    });


const tamanoArchivo =
    computed(() => {

      if (!archivoSeleccionado.value) {
        return "";
      }

      const bytes =
          archivoSeleccionado.value.size;

      if (bytes < 1024) {
        return `${bytes} B`;
      }

      if (bytes < 1024 * 1024) {
        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
      }

      return `${(
          bytes / (1024 * 1024)
      ).toFixed(1)} MB`;
    });


const pasoActual =
    computed(() => {

      if (
          guardando.value ||
          actualizando.value
      ) {
        return 3;
      }

      if (
          analisis.value &&
          analisisValido.value
      ) {
        return 3;
      }

      if (
          cargando.value ||
          analisis.value
      ) {
        return 2;
      }

      return 1;
    });


// =========================================================
// ARCHIVOS
// =========================================================

function abrirSelector() {

  if (
      cargando.value ||
      comparando.value ||
      guardando.value ||
      actualizando.value
  ) {
    return;
  }

  inputArchivo.value?.click();
}


async function seleccionarArchivo(
    evento: Event
) {

  const input =
      evento.target as HTMLInputElement;

  const archivo =
      input.files?.[0];

  if (!archivo) {
    return;
  }

  await procesarArchivo(
      archivo
  );

  input.value = "";
}


async function manejarDrop(
    evento: DragEvent
) {

  arrastrando.value =
      false;

  if (
      cargando.value ||
      comparando.value ||
      guardando.value ||
      actualizando.value
  ) {
    return;
  }

  const archivo =
      evento.dataTransfer
          ?.files?.[0];

  if (!archivo) {
    return;
  }

  await procesarArchivo(
      archivo
  );
}


function validarExtension(
    archivo: File
): boolean {

  const nombre =
      archivo.name
          .toLowerCase();

  return (
      nombre.endsWith(".xlsx") ||
      nombre.endsWith(".xlsm")
  );
}


function mostrarValor(
    valor: unknown
): string {

  if (
      valor === null ||
      valor === undefined ||
      valor === ""
  ) {
    return "—";
  }

  if (
      valor instanceof Date
  ) {
    return valor.toLocaleString("es-PE");
  }


  if (
      typeof valor === "object"
  ) {

    try {
      return JSON.stringify(valor);
    } catch {
      return String(valor);
    }
  }

  return String(valor);
}


// =========================================================
// DETALLE DE LA COMPARACIÓN E HISTORIAL
// =========================================================

/*
 * Lo que cambiaría con este archivo, en el mismo formato
 * que la auditoría de cargas.
 */
const filasComparacion = computed<FilaCambio[]>(() => {
  const resultado = comparacion.value;

  if (!resultado) {
    return [];
  }

  const codigo = FUENTES_IMPORTACION[resultado.fuente].codigo;

  const fila = (
      item: { idDocumento: string; idPrincipal: string; nombre: string; cambios?: FilaCambio["campos"] },
      tipo: FilaCambio["tipo"]
  ): FilaCambio => ({
    id: `${tipo}_${item.idDocumento}`,
    tipo,
    codigoFuente: codigo,
    idDocumento: item.idDocumento,
    idPrincipal: item.idPrincipal,
    nombre: item.nombre,
    campos: item.cambios ?? []
  });

  return [
    ...resultado.modificados.map(item => fila(item, "MODIFICADO")),
    ...(resultado.reactivados ?? []).map(item => fila(item, "REACTIVADO")),
    ...resultado.nuevos.map(item => fila(item, "NUEVO")),
    ...resultado.inactivos.map(item => fila(item, "INACTIVADO"))
  ];
});


const historialCargas = ref<Carga[]>([]);
const cargandoHistorial = ref(false);

async function cargarHistorial() {
  cargandoHistorial.value = true;

  try {
    historialCargas.value = await listarCargas(30);
  } catch (e) {
    console.error("Error leyendo el historial de cargas:", e);
  } finally {
    cargandoHistorial.value = false;
  }
}

onMounted(cargarHistorial);


async function prepararComparacion(
    resultado: AnalisisExcel
) {

  baselineExistente.value =
      false;

  comparacion.value =
      null;

  mensajeActualizacion.value =
      "";

  actualizacionAplicada.value =
      false;


  if (
      resultado.fuente ===
      "DESCONOCIDA"
  ) {
    return;
  }


  baselineExistente.value =
      await existeBaselineFuente(
          resultado.fuente
      );


  if (!baselineExistente.value) {
    return;
  }


  const validacionResultado =
      validarRegistrosExcel(
          resultado.registros,
          resultado.fuente
      );


  const esValido =
      validacionResultado.valido &&
      resultado
          .camposObligatoriosFaltantes
          .length === 0;


  if (!esValido) {
    return;
  }


  comparando.value =
      true;


  try {

    comparacion.value =
        await compararConUltimaCarga(
            resultado.registros,
            resultado.fuente
        );

  } finally {

    comparando.value =
        false;
  }
}


async function procesarArchivo(
    archivo: File
) {

  if (!validarExtension(archivo)) {

    error.value =
        "Formato no compatible. Selecciona un archivo .xlsx o .xlsm.";

    return;
  }

  archivoSeleccionado.value =
      archivo;

  analisis.value =
      null;

  error.value =
      "";

  mensajeBaseline.value =
      "";

  baselineGuardado.value =
      false;

  baselineExistente.value =
      false;

  comparacion.value =
      null;

  mensajeActualizacion.value =
      "";

  actualizacionAplicada.value =
      false;

  cargando.value =
      true;

  try {

    const resultado =
        await analizarExcel(
            archivo
        );

    analisis.value =
        resultado;

    cargando.value =
        false;

    await prepararComparacion(
        resultado
    );

  } catch (e) {

    console.error(
        "Error al analizar Excel:",
        e
    );

    error.value =
        e instanceof Error
            ? e.message
            : "Ocurrió un error al analizar el archivo.";

  } finally {

    cargando.value =
        false;
  }
}


// =========================================================
// BASELINE
// =========================================================

async function guardarComoBaseline() {

  if (!analisis.value) {
    return;
  }

  if (!validacion.value) {
    return;
  }

  if (!validacion.value.valido) {

    error.value =
        validacion.value
            .errores
            .join(" ");

    return;
  }

  if (
      analisis.value
          .camposObligatoriosFaltantes
          .length > 0
  ) {

    error.value =
        "No se puede crear la base inicial porque faltan campos obligatorios.";

    return;
  }

  if (
      analisis.value.fuente ===
      "DESCONOCIDA"
  ) {

    error.value =
        "No se puede crear una base inicial para una fuente desconocida.";

    return;
  }

  const confirmar =
      window.confirm(
          `Se guardarán ${analisis.value.totalRegistros} ` +
          `registros de ${etiquetaFuente.value} ` +
          `como base inicial de Project Insight V2.\n\n` +
          `Esta será la referencia para comparar los próximos archivos ` +
          `de esta misma fuente.\n\n` +
          `¿Deseas continuar?`
      );

  if (!confirmar) {
    return;
  }

  guardando.value =
      true;

  error.value =
      "";

  mensajeBaseline.value =
      "";

  try {

    const resultado =
        await establecerBaseline(
            analisis.value.registros,
            analisis.value.archivo,
            analisis.value.hoja,
            analisis.value.filaCabecera,
            analisis.value.fuente
        );

    baselineGuardado.value =
        true;

    cargarHistorial();

    mensajeBaseline.value =
        `Base inicial de ${etiquetaFuente.value} creada correctamente. ` +
        `${resultado.guardados} registros guardados.`;

  } catch (e) {

    console.error(
        "Error al crear baseline:",
        e
    );

    error.value =
        e instanceof Error
            ? e.message
            : "No se pudo crear la base inicial.";

  } finally {

    guardando.value =
        false;
  }
}


async function confirmarActualizacion() {

  if (
      !analisis.value ||
      !comparacion.value
  ) {
    return;
  }


  const resumen =
      comparacion.value.resumen;


  const confirmar =
      window.confirm(
          `Se actualizará ${etiquetaFuente.value}.\n\n` +
          `Nuevos: ${resumen.nuevos}\n` +
          `Modificados: ${resumen.modificados}\n` +
          `Sin cambios: ${resumen.sinCambios}\n` +
          `Inactivos: ${resumen.inactivos}\n\n` +
          `Los registros inactivos no se eliminarán; ` +
          `solo se marcarán como inactivos para esta fuente.\n\n` +
          `¿Deseas continuar?`
      );


  if (!confirmar) {
    return;
  }


  actualizando.value =
      true;

  error.value =
      "";

  mensajeActualizacion.value =
      "";


  try {

    const resultado =
        await aplicarActualizacionFuente(
            analisis.value.registros,
            analisis.value.archivo,
            analisis.value.hoja,
            analisis.value.filaCabecera,
            analisis.value.fuente
        );


    comparacion.value =
        resultado.comparacion;

    actualizacionAplicada.value =
        true;

    cargarHistorial();

    mensajeActualizacion.value =
        `Actualización completada correctamente. ` +
        `Carga ${resultado.idCarga} registrada.`;

  } catch (e) {

    console.error(
        "Error al actualizar la fuente:",
        e
    );

    error.value =
        e instanceof Error
            ? e.message
            : "No se pudo aplicar la actualización.";

  } finally {

    actualizando.value =
        false;
  }
}
</script>


<template>

  <section class="import-page">

    <!-- =====================================================
         CABECERA INTERNA
         ===================================================== -->

    <div class="page-intro">

      <div>

        <div class="eyebrow">
          <i class="pi pi-database" />
          Centro de datos
        </div>

        <h2>
          Nueva importación
        </h2>

        <p>
          Carga un archivo y Project Insight detectará
          automáticamente su fuente, estructura y campos.
        </p>

      </div>


      <div class="support-badges">

        <span class="support-badge">
          <i class="pi pi-file-excel" />
          XLSX / XLSM
        </span>

        <span class="support-badge">
          <i class="pi pi-sparkles" />
          Detección automática
        </span>

      </div>

    </div>


    <!-- =====================================================
         PROGRESO
         ===================================================== -->

    <div class="steps-card">

      <div
          class="step"
          :class="{
          active: pasoActual >= 1,
          completed: pasoActual > 1
        }"
      >

        <div class="step-marker">
          <i
              v-if="pasoActual > 1"
              class="pi pi-check"
          />

          <span v-else>
            1
          </span>
        </div>

        <div class="step-copy">
          <strong>Seleccionar archivo</strong>
          <span>Demanda Táctica o ClearQuest</span>
        </div>

      </div>


      <div class="step-line" />


      <div
          class="step"
          :class="{
          active: pasoActual >= 2,
          completed: pasoActual > 2
        }"
      >

        <div class="step-marker">
          <i
              v-if="pasoActual > 2"
              class="pi pi-check"
          />

          <span v-else>
            2
          </span>
        </div>

        <div class="step-copy">
          <strong>Analizar y validar</strong>
          <span>Estructura, campos e identificadores</span>
        </div>

      </div>


      <div class="step-line" />


      <div
          class="step"
          :class="{
          active: pasoActual >= 3
        }"
      >

        <div class="step-marker">
          3
        </div>

        <div class="step-copy">
          <strong>
            {{
              baselineExistente
                  ? "Confirmar actualización"
                  : "Confirmar carga"
            }}
          </strong>

          <span>
            {{
              baselineExistente
                  ? "Aplicar diferencias detectadas"
                  : "Establecer la base de la fuente"
            }}
          </span>
        </div>

      </div>

    </div>


    <!-- =====================================================
         DROPZONE
         ===================================================== -->

    <div class="panel upload-panel">

      <div class="panel-heading">

        <div>
          <h3>Archivo de origen</h3>

          <p>
            Selecciona el Excel que deseas analizar.
          </p>
        </div>

        <span
            v-if="archivoSeleccionado"
            class="ready-chip"
        >
          <i class="pi pi-check-circle" />
          Archivo seleccionado
        </span>

      </div>


      <input
          ref="inputArchivo"
          class="hidden-input"
          type="file"
          accept=".xlsx,.xlsm"
          :disabled="cargando || comparando || guardando || actualizando"
          @change="seleccionarArchivo"
      />


      <div
          class="dropzone"
          :class="{
          dragging: arrastrando,
          disabled: cargando || comparando || guardando || actualizando
        }"
          role="button"
          tabindex="0"
          @click="abrirSelector"
          @keydown.enter="abrirSelector"
          @dragover.prevent="
          arrastrando = true
        "
          @dragleave.prevent="
          arrastrando = false
        "
          @drop.prevent="manejarDrop"
      >

        <template
            v-if="!archivoSeleccionado"
        >

          <div class="upload-icon">
            <i class="pi pi-cloud-upload" />
          </div>

          <div class="drop-copy">

            <strong>
              Arrastra tu archivo aquí
            </strong>

            <span>
              o haz clic para seleccionarlo desde tu equipo
            </span>

          </div>

          <button
              class="secondary-button"
              type="button"
              :disabled="cargando || comparando || guardando || actualizando"
              @click.stop="abrirSelector"
          >
            <i class="pi pi-folder-open" />
            Seleccionar archivo
          </button>

        </template>


        <template v-else>

          <div class="file-icon">
            <i class="pi pi-file-excel" />
          </div>

          <div class="selected-file">

            <strong>
              {{ archivoSeleccionado.name }}
            </strong>

            <span>
              {{ tamanoArchivo }} · Excel
            </span>

          </div>

          <button
              class="secondary-button"
              type="button"
              :disabled="cargando || comparando || guardando || actualizando"
              @click.stop="abrirSelector"
          >
            <i class="pi pi-refresh" />
            Cambiar
          </button>

        </template>

      </div>


      <div class="upload-note">

        <i class="pi pi-info-circle" />

        <span>
          Project Insight inspecciona todas las hojas y busca
          automáticamente la fila de cabecera más probable.
        </span>

      </div>

    </div>


    <!-- =====================================================
         CARGANDO
         ===================================================== -->

    <div
        v-if="cargando"
        class="analysis-loading panel"
    >

      <div class="spinner">
        <i class="pi pi-spin pi-spinner" />
      </div>

      <div>
        <strong>
          Analizando archivo...
        </strong>

        <p>
          Estamos detectando la fuente, cabeceras,
          columnas y registros.
        </p>
      </div>

    </div>


    <div
        v-if="comparando"
        class="analysis-loading panel"
    >

      <div class="spinner">
        <i class="pi pi-spin pi-spinner" />
      </div>

      <div>
        <strong>
          Comparando con la última carga...
        </strong>

        <p>
          Project Insight está identificando registros nuevos,
          modificados, sin cambios e inactivos.
        </p>
      </div>

    </div>


    <!-- =====================================================
         ERROR
         ===================================================== -->

    <div
        v-if="error"
        class="alert alert-error"
    >

      <div class="alert-icon">
        <i class="pi pi-exclamation-circle" />
      </div>

      <div>
        <strong>
          No se pudo completar la operación
        </strong>

        <p>
          {{ error }}
        </p>
      </div>

    </div>


    <!-- =====================================================
         RESULTADOS
         ===================================================== -->

    <template v-if="analisis">

      <!-- RESUMEN PRINCIPAL -->

      <div class="result-grid">

        <div class="panel source-panel">

          <div class="source-header">

            <div>

              <span class="section-label">
                Fuente detectada
              </span>

              <div class="source-title-row">

                <span
                    class="source-badge"
                    :class="claseFuente"
                >

                  <i
                      :class="
                      analisis.fuente === 'CLEARQUEST'
                        ? 'pi pi-database'
                        : analisis.fuente === 'LISTADO'
                          ? 'pi pi-list'
                          : 'pi pi-table'
                    "
                  />

                  {{ etiquetaFuente }}

                </span>

                <span
                    v-if="analisisValido"
                    class="status-badge status-ok"
                >
                  <i class="pi pi-check-circle" />
                  Archivo válido
                </span>

                <span
                    v-else
                    class="status-badge status-warning"
                >
                  <i class="pi pi-exclamation-triangle" />
                  Requiere revisión
                </span>

              </div>

            </div>


            <div class="source-meta">

              <div>
                <span>Código de fuente</span>
                <strong>{{ analisis.fuente }}</strong>
              </div>

              <div>
                <span title="Puntuación interna usada para identificar la fuente">
                  Puntaje detección
                </span>
                <strong>{{ analisis.confianzaFuente }}</strong>
              </div>

            </div>

          </div>

        </div>


        <div
            class="panel validation-summary"
            :class="{
            valid: analisisValido,
            invalid: !analisisValido
          }"
        >

          <div class="validation-icon">

            <i
                :class="
                analisisValido
                  ? 'pi pi-check'
                  : 'pi pi-exclamation-triangle'
              "
            />

          </div>

          <div>

            <strong>
              {{
                analisisValido
                    ? "Validación completada"
                    : "Validación con observaciones"
              }}
            </strong>

            <span>
              {{
                analisisValido
                    ? "El archivo está listo para continuar."
                    : "Revisa los campos e identificadores."
              }}
            </span>

          </div>

        </div>

      </div>


      <!-- MÉTRICAS -->

      <div class="metrics-grid">

        <div class="metric-card">

          <div class="metric-icon">
            <i class="pi pi-clone" />
          </div>

          <div>
            <span>Hoja detectada</span>

            <strong
                class="metric-text"
                :title="analisis.hoja"
            >
              {{ analisis.hoja }}
            </strong>
          </div>

        </div>


        <div class="metric-card">

          <div class="metric-icon">
            <i class="pi pi-align-justify" />
          </div>

          <div>
            <span>Fila de cabecera</span>
            <strong>{{ analisis.filaCabecera }}</strong>
          </div>

        </div>


        <div class="metric-card">

          <div class="metric-icon">
            <i class="pi pi-list" />
          </div>

          <div>
            <span>Registros</span>
            <strong>{{ analisis.totalRegistros }}</strong>
          </div>

        </div>


        <div class="metric-card">

          <div class="metric-icon">
            <i class="pi pi-th-large" />
          </div>

          <div>
            <span>Columnas</span>
            <strong>{{ analisis.totalColumnas }}</strong>
          </div>

        </div>


        <div class="metric-card">

          <div class="metric-icon recognized">
            <i class="pi pi-check-square" />
          </div>

          <div>
            <span>Campos reconocidos</span>
            <strong>{{ analisis.camposDetectados.length }}</strong>
          </div>

        </div>

      </div>


      <!-- VALIDACIÓN DETALLADA -->

      <div class="panel">

        <div class="panel-heading">

          <div>
            <h3>Validación del archivo</h3>

            <p>
              Control de identificadores y campos obligatorios.
            </p>
          </div>

          <span
              class="status-badge"
              :class="
              analisisValido
                ? 'status-ok'
                : 'status-warning'
            "
          >

            <i
                :class="
                analisisValido
                  ? 'pi pi-verified'
                  : 'pi pi-exclamation-triangle'
              "
            />

            {{
              analisisValido
                  ? "Sin observaciones"
                  : "Revisar"
            }}

          </span>

        </div>


        <div
            v-if="
            validacion &&
            analisisValido
          "
            class="validation-content"
        >

          <div class="success-message">

            <i class="pi pi-check-circle" />

            <div>
              <strong>
                Archivo validado correctamente
              </strong>

              <span>
                Project Insight lo identificó como
                {{ etiquetaFuente }}.
              </span>
            </div>

          </div>


          <div class="validation-stats">

            <div>
              <span>Registros válidos</span>
              <strong>{{ validacion.registrosValidos }}</strong>
            </div>

            <div>
              <span>Sin ID</span>
              <strong>{{ validacion.registrosSinId }}</strong>
            </div>

            <div>
              <span>IDs duplicados</span>
              <strong>{{ validacion.idsDuplicados.length }}</strong>
            </div>

            <div>
              <span>Identificador usado</span>
              <strong class="code-value">
                {{ validacion.campoIdentificador }}
              </strong>
            </div>

          </div>

        </div>


        <div
            v-else
            class="validation-errors"
        >

          <div
              v-if="
              analisis
                .camposObligatoriosFaltantes
                .length > 0
            "
              class="issue-block"
          >

            <div class="issue-title">
              <i class="pi pi-exclamation-circle" />
              Campos obligatorios faltantes
            </div>

            <div class="issue-chips">

              <span
                  v-for="
                  campo
                  in analisis.camposObligatoriosFaltantes
                "
                  :key="campo"
              >
                {{ campo }}
              </span>

            </div>

          </div>


          <div
              v-if="
              validacion &&
              validacion.errores.length > 0
            "
              class="issue-list"
          >

            <p
                v-for="
                problema
                in validacion.errores
              "
                :key="problema"
            >
              <i class="pi pi-times-circle" />
              {{ problema }}
            </p>

          </div>

        </div>

      </div>


      <!-- DETALLES TÉCNICOS -->

      <div class="details-grid">

        <div class="panel">

          <div class="panel-heading">

            <div>
              <h3>Mapeo detectado</h3>

              <p>
                Relación entre columnas del Excel y Project Insight.
              </p>
            </div>

            <span class="count-badge">
              {{ analisis.camposDetectados.length }}
              campos
            </span>

          </div>


          <div class="table-wrapper mapping-table">

            <table>

              <thead>
              <tr>
                <th>Columna Excel</th>
                <th>Campo Project Insight</th>
                <th>Tipo</th>
              </tr>
              </thead>

              <tbody>

              <tr
                  v-for="
                    campo
                    in analisis.camposDetectados
                  "
                  :key="
                    `${campo.campoCanonico}-${campo.indiceColumna}`
                  "
              >

                <td>
                    <span class="excel-column">
                      {{ campo.columnaExcel }}
                    </span>
                </td>

                <td>
                    <span class="canonical-field">
                      {{ campo.campoCanonico }}
                    </span>
                </td>

                <td>

                    <span
                        class="field-type"
                        :class="{
                        required: campo.obligatorio
                      }"
                    >
                      {{
                        campo.obligatorio
                            ? "Obligatorio"
                            : "Opcional"
                      }}
                    </span>

                </td>

              </tr>

              </tbody>

            </table>

          </div>

        </div>


        <div class="panel unused-panel">

          <div class="panel-heading">

            <div>
              <h3>Columnas adicionales</h3>

              <p>
                Se guardan tal cual y se muestran en el detalle del requerimiento.
              </p>
            </div>

            <span class="count-badge neutral">
              {{ analisis.columnasNoReconocidas.length }}
            </span>

          </div>


          <div class="unused-body">

            <div
                v-if="
                analisis.columnasNoReconocidas.length > 0
              "
                class="unused-info"
            >

              <i class="pi pi-info-circle" />

              <span>
                No representan un error. No tienen un campo propio
                en Project Insight, pero su valor se conserva.
              </span>

            </div>


            <div
                v-if="
                analisis.columnasNoReconocidas.length > 0
              "
                class="chips"
            >

              <span
                  v-for="
                  columna
                  in analisis.columnasNoReconocidas
                "
                  :key="columna"
                  class="chip"
              >
                {{ columna }}
              </span>

            </div>


            <div
                v-else
                class="empty-success"
            >

              <i class="pi pi-check-circle" />

              Todas las columnas fueron reconocidas.

            </div>

          </div>

        </div>

      </div>


      <!-- VISTA PREVIA -->

      <div
          v-if="configuracionFuente"
          class="panel preview-panel"
      >

        <div class="panel-heading">

          <div>

            <div class="heading-with-badge">
              <h3>Vista previa</h3>

              <span
                  class="source-mini"
                  :class="claseFuente"
              >
                {{ configuracionFuente.nombre }}
              </span>
            </div>

            <p>
              Primeros 10 registros detectados en el archivo.
            </p>

          </div>

          <span class="count-badge">
            10 máx.
          </span>

        </div>


        <div class="table-wrapper">

          <table class="preview-table">

            <thead>
            <tr>
              <th
                  v-for="columna in configuracionFuente.columnasVista"
                  :key="columna.campo"
              >
                {{ columna.titulo }}
              </th>
            </tr>
            </thead>

            <tbody>

            <tr
                v-for="
                  (registro, index)
                  in analisis.registros.slice(0, 10)
                "
                :key="index"
            >

              <td
                  v-for="columna in configuracionFuente.columnasVista"
                  :key="columna.campo"
                  :class="{
                    'requirement-cell':
                      columna.campo === configuracionFuente.campoNombre
                  }"
              >
                {{ mostrarValor(registro[columna.campo]) }}
              </td>

            </tr>

            </tbody>

          </table>

        </div>

      </div>


      <!-- COMPARACIÓN CON ÚLTIMA CARGA -->

      <div
          v-if="
          baselineExistente &&
          comparacion
        "
          class="update-panel"
      >

        <div class="update-header">

          <div>

            <span class="section-label">
              Comparación automática
            </span>

            <h3>
              Cambios detectados en {{ etiquetaFuente }}
            </h3>

            <p>
              El baseline ya existe. Revisa las diferencias
              antes de actualizar Firestore.
            </p>

          </div>

          <span class="baseline-detected">
            <i class="pi pi-history" />
            Baseline encontrado
          </span>

        </div>


        <div class="comparison-metrics">

          <div class="comparison-card new">

            <div class="comparison-icon">
              <i class="pi pi-plus" />
            </div>

            <div>
              <strong>
                {{ comparacion.resumen.nuevos }}
              </strong>

              <span>Nuevos</span>
            </div>

          </div>


          <div class="comparison-card modified">

            <div class="comparison-icon">
              <i class="pi pi-pencil" />
            </div>

            <div>
              <strong>
                {{ comparacion.resumen.modificados }}
              </strong>

              <span>Modificados</span>
            </div>

          </div>


          <div class="comparison-card unchanged">

            <div class="comparison-icon">
              <i class="pi pi-check" />
            </div>

            <div>
              <strong>
                {{ comparacion.resumen.sinCambios }}
              </strong>

              <span>Sin cambios</span>
            </div>

          </div>


          <div class="comparison-card inactive">

            <div class="comparison-icon">
              <i class="pi pi-minus-circle" />
            </div>

            <div>
              <strong>
                {{ comparacion.resumen.inactivos }}
              </strong>

              <span>Inactivos</span>
            </div>

          </div>

        </div>


        <div
            v-if="filasComparacion.length > 0"
            class="changes-preview"
        >
          <div class="changes-preview-header">
            <div>
              <strong>
                Detalle de cambios
              </strong>
              <span>
                Abre un registro para ver el valor anterior y el nuevo de cada campo.
                <template v-if="comparacion.resumen.reactivados > 0">
                  {{ comparacion.resumen.reactivados }} registro(s) vuelven a aparecer y se reactivarán.
                </template>
              </span>
            </div>
            <span class="count-badge">
              {{ filasComparacion.length }}
            </span>
          </div>

          <CambiosTabla :filas="filasComparacion" />
        </div>


        <div
            v-if="
            comparacion.inactivos.length > 0
          "
            class="inactive-note"
        >

          <i class="pi pi-info-circle" />

          <span>
            {{ comparacion.inactivos.length }}
            registros estaban activos en la carga anterior
            y ya no aparecen en este Excel. No serán eliminados:
            se marcarán como inactivos para {{ etiquetaFuente }}.
          </span>

        </div>


        <div class="update-action">

          <div>

            <strong>
              {{ comparacion.totalArchivo }}
              registros en el archivo
            </strong>

            <span>
              Los registros sin cambios no generan una
              escritura innecesaria en Firestore.
            </span>

          </div>


          <button
              class="primary-button"
              :disabled="!puedeActualizar"
              @click="confirmarActualizacion"
          >

            <i
                :class="
                actualizando
                  ? 'pi pi-spin pi-spinner'
                  : actualizacionAplicada
                    ? 'pi pi-check'
                    : 'pi pi-refresh'
              "
            />

            {{
              actualizando
                  ? "Actualizando..."
                  : actualizacionAplicada
                      ? "Actualización aplicada"
                      : "Confirmar actualización"
            }}

          </button>

        </div>


        <div
            v-if="mensajeActualizacion"
            class="update-success"
        >

          <i class="pi pi-check-circle" />

          {{ mensajeActualizacion }}

        </div>

      </div>


      <!-- CONFIRMACIÓN -->

      <div
          v-if="
          analisis.fuente !==
          'DESCONOCIDA' &&
          !baselineExistente
        "
          class="baseline-card"
          :class="{
          completed: baselineGuardado
        }"
      >

        <div class="baseline-icon">

          <i
              :class="
              baselineGuardado
                ? 'pi pi-check'
                : 'pi pi-database'
            "
          />

        </div>


        <div class="baseline-copy">

          <span class="section-label">
            Paso final
          </span>

          <h3>
            Base inicial de {{ etiquetaFuente }}
          </h3>

          <p>
            Esta carga establecerá el punto de referencia
            para las futuras comparaciones de esta fuente.
          </p>

          <div
              v-if="mensajeBaseline"
              class="inline-success"
          >
            <i class="pi pi-check-circle" />
            {{ mensajeBaseline }}
          </div>

        </div>


        <div class="baseline-action">

          <div class="baseline-count">
            <strong>
              {{ analisis.totalRegistros }}
            </strong>

            <span>
              registros listos
            </span>
          </div>

          <button
              class="primary-button"
              :disabled="!puedeCrearBaseline"
              @click="guardarComoBaseline"
          >

            <i
                :class="
                guardando
                  ? 'pi pi-spin pi-spinner'
                  : baselineGuardado
                    ? 'pi pi-check'
                    : 'pi pi-check-circle'
              "
            />

            {{
              guardando
                  ? "Guardando..."
                  : baselineGuardado
                      ? "Base inicial creada"
                      : "Establecer base inicial"
            }}

          </button>

        </div>

      </div>

    </template>

    <div class="history-panel">
      <div class="history-header">
        <div>
          <span class="section-label">Trazabilidad</span>
          <h3>Historial de cargas</h3>
          <p>
            Últimos archivos cargados de cada fuente. Haz clic en una carga para ver
            en Auditoría qué registros cambiaron.
          </p>
        </div>
        <RouterLink :to="{ name: 'auditoria' }" class="history-link">
          Ir a Auditoría <i class="pi pi-arrow-right" />
        </RouterLink>
      </div>

      <HistorialCargas
          :cargas="historialCargas"
          :cargando="cargandoHistorial"
          :filas-por-pagina="5"
          @seleccionar="$router.push({ name: 'auditoria', query: { carga: $event.id } })"
      />
    </div>

  </section>

</template>


<style scoped>

/* =========================================================
   PAGE
   ========================================================= */

.import-page {
  width: 100%;
  padding-bottom: 28px;
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


.eyebrow i {
  font-size: 10px;
}


.page-intro h2 {
  margin: 0;

  color: var(--pi-text);

  font-size: 20px;
  font-weight: 700;

  letter-spacing: -0.025em;
}


.page-intro p {
  max-width: 640px;

  margin: 5px 0 0;

  color: var(--pi-text-muted);

  font-size: 12px;

  line-height: 1.55;
}


.support-badges {
  display: flex;

  flex-wrap: wrap;

  justify-content: flex-end;

  gap: 7px;
}


.support-badge {
  display: inline-flex;

  align-items: center;

  gap: 6px;

  min-height: 29px;

  padding: 5px 9px;

  border:
      1px solid var(--pi-border);

  border-radius: 999px;

  background:
      var(--pi-surface);

  color:
      var(--pi-text-secondary);

  font-size: 10px;
  font-weight: 600;
}


.support-badge i {
  color: var(--pi-primary);

  font-size: 10px;
}


/* =========================================================
   STEPS
   ========================================================= */

.steps-card {
  display: grid;

  grid-template-columns:
    auto 1fr
    auto 1fr
    auto;

  align-items: center;

  gap: 12px;

  margin-bottom: 16px;

  padding: 13px 16px;

  border:
      1px solid var(--pi-border);

  border-radius:
      var(--pi-radius-lg);

  background:
      var(--pi-surface);

  box-shadow:
      var(--pi-shadow-sm);
}


.step {
  display: flex;

  align-items: center;

  gap: 9px;

  min-width: 0;

  opacity: 0.48;

  transition:
      opacity var(--pi-transition);
}


.step.active {
  opacity: 1;
}


.step-marker {
  display: flex;

  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 28px;
  height: 28px;

  border:
      1px solid var(--pi-border-strong);

  border-radius: 50%;

  background:
      var(--pi-surface);

  color:
      var(--pi-text-muted);

  font-size: 10px;
  font-weight: 700;
}


.step.active
.step-marker {
  border-color: #bfdbfe;

  background:
      var(--pi-primary-soft);

  color:
      var(--pi-primary);
}


.step.completed
.step-marker {
  border-color: #bbf7d0;

  background:
      var(--pi-success-soft);

  color:
      var(--pi-success);
}


.step-marker i {
  font-size: 10px;
}


.step-copy {
  display: flex;

  flex-direction: column;

  min-width: 0;
}


.step-copy strong {
  overflow: hidden;

  color:
      var(--pi-text-secondary);

  font-size: 10px;
  font-weight: 650;

  text-overflow: ellipsis;

  white-space: nowrap;
}


.step.active
.step-copy strong {
  color:
      var(--pi-text);
}


.step-copy span {
  margin-top: 2px;

  overflow: hidden;

  color:
      var(--pi-text-muted);

  font-size: 8px;

  text-overflow: ellipsis;

  white-space: nowrap;
}


.step-line {
  height: 1px;

  background:
      var(--pi-border);
}


/* =========================================================
   COMMON PANEL
   ========================================================= */

.panel {
  margin-bottom: 16px;

  overflow: hidden;

  border:
      1px solid var(--pi-border);

  border-radius:
      var(--pi-radius-lg);

  background:
      var(--pi-surface);

  box-shadow:
      var(--pi-shadow-sm);
}


.panel-heading {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 16px;

  padding: 16px 18px;

  border-bottom:
      1px solid var(--pi-border);
}


.panel-heading h3 {
  margin: 0;

  color:
      var(--pi-text);

  font-size: 13px;
  font-weight: 680;
}


.panel-heading p {
  margin: 3px 0 0;

  color:
      var(--pi-text-muted);

  font-size: 10px;
}


/* =========================================================
   UPLOAD
   ========================================================= */

.upload-panel {
  overflow: visible;
}


.hidden-input {
  display: none;
}


.ready-chip {
  display: inline-flex;

  align-items: center;

  gap: 5px;

  padding:
      5px 8px;

  border-radius: 999px;

  background:
      var(--pi-success-soft);

  color:
      var(--pi-success);

  font-size: 9px;
  font-weight: 650;
}


.dropzone {
  display: flex;

  align-items: center;

  min-height: 94px;

  margin: 16px 18px 10px;

  padding: 16px;

  gap: 14px;

  border:
      1px dashed
      var(--pi-border-strong);

  border-radius:
      11px;

  background:
      var(--pi-surface-soft);

  cursor: pointer;

  transition:
      border-color
      var(--pi-transition),
      background
      var(--pi-transition),
      box-shadow
      var(--pi-transition);
}


.dropzone:hover,
.dropzone.dragging {
  border-color:
      #93c5fd;

  background:
      #f8fbff;

  box-shadow:
      0 0 0 3px
      rgba(
          37,
          99,
          235,
          0.05
      );
}


.dropzone.disabled {
  cursor: not-allowed;

  opacity: 0.62;
}


.upload-icon,
.file-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 44px;
  height: 44px;

  border-radius:
      11px;

  background:
      var(--pi-primary-soft);

  color:
      var(--pi-primary);
}


.upload-icon i {
  font-size: 18px;
}


.file-icon {
  background:
      var(--pi-success-soft);

  color:
      var(--pi-success);
}


.file-icon i {
  font-size: 18px;
}


.drop-copy,
.selected-file {
  display: flex;

  flex: 1;
  flex-direction: column;

  min-width: 0;
}


.drop-copy strong,
.selected-file strong {
  overflow: hidden;

  color:
      var(--pi-text);

  font-size: 12px;
  font-weight: 650;

  text-overflow: ellipsis;

  white-space: nowrap;
}


.drop-copy span,
.selected-file span {
  margin-top: 4px;

  color:
      var(--pi-text-muted);

  font-size: 10px;
}


.secondary-button {
  display: inline-flex;

  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  min-height: 34px;

  padding:
      0 12px;

  gap: 7px;

  border:
      1px solid var(--pi-border);

  border-radius:
      var(--pi-radius-sm);

  background:
      var(--pi-surface);

  color:
      var(--pi-text-secondary);

  font-size: 10px;
  font-weight: 600;

  cursor: pointer;

  transition:
      background
      var(--pi-transition),
      border-color
      var(--pi-transition);
}


.secondary-button:hover:not(:disabled) {
  background:
      var(--pi-surface-muted);

  border-color:
      var(--pi-border-strong);
}


.secondary-button:disabled {
  cursor: not-allowed;

  opacity: 0.55;
}


.secondary-button i {
  font-size: 10px;
}


.upload-note {
  display: flex;

  align-items: center;

  gap: 7px;

  padding:
      0 18px 14px;

  color:
      var(--pi-text-muted);

  font-size: 9px;
}


.upload-note i {
  color:
      var(--pi-primary);

  font-size: 10px;
}


/* =========================================================
   LOADING / ALERT
   ========================================================= */

.analysis-loading {
  display: flex;

  align-items: center;

  padding: 18px;

  gap: 13px;
}


.analysis-loading strong {
  color:
      var(--pi-text);

  font-size: 12px;
}


.analysis-loading p {
  margin: 3px 0 0;

  color:
      var(--pi-text-muted);

  font-size: 10px;
}


.spinner {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 36px;
  height: 36px;

  border-radius: 50%;

  background:
      var(--pi-primary-soft);

  color:
      var(--pi-primary);
}


.spinner i {
  font-size: 15px;
}


.alert {
  display: flex;

  align-items: flex-start;

  gap: 11px;

  margin-bottom: 16px;

  padding: 13px 15px;

  border-radius:
      var(--pi-radius-md);
}


.alert-error {
  border:
      1px solid #fecaca;

  background:
      var(--pi-danger-soft);

  color:
      #991b1b;
}


.alert-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 25px;
  height: 25px;

  border-radius: 50%;

  background:
      #fee2e2;
}


.alert-icon i {
  font-size: 12px;
}


.alert strong {
  font-size: 11px;
}


.alert p {
  margin: 3px 0 0;

  color:
      inherit;

  font-size: 10px;

  line-height: 1.45;
}


/* =========================================================
   SOURCE SUMMARY
   ========================================================= */

.result-grid {
  display: grid;

  grid-template-columns:
    minmax(0, 1.6fr)
    minmax(260px, 0.8fr);

  gap: 14px;

  margin-bottom: 14px;
}


.source-panel {
  margin-bottom: 0;
}


.source-header {
  display: flex;

  align-items: center;
  justify-content: space-between;

  min-height: 102px;

  padding: 17px 18px;

  gap: 18px;
}


.section-label {
  display: block;

  margin-bottom: 6px;

  color:
      var(--pi-text-muted);

  font-size: 8px;
  font-weight: 700;

  letter-spacing: 0.07em;

  text-transform: uppercase;
}


.source-title-row {
  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap: 8px;
}


.source-badge,
.source-mini {
  display: inline-flex;

  align-items: center;

  gap: 6px;

  border-radius: 999px;

  font-weight: 650;
}


.source-badge {
  min-height: 30px;

  padding:
      5px 10px;

  font-size: 11px;
}


.source-badge i {
  font-size: 10px;
}


.source-mini {
  padding:
      4px 7px;

  font-size: 8px;
}


.source-dt {
  background:
      #eff6ff;

  color:
      #1d4ed8;
}


.source-cq {
  background:
      #f5f3ff;

  color:
      #6d28d9;
}


.source-ls {
  background:
      #fff7ed;

  color:
      #c2410c;
}


.source-unknown {
  background:
      #f1f5f9;

  color:
      #475569;
}


.status-badge {
  display: inline-flex;

  align-items: center;

  gap: 5px;

  min-height: 26px;

  padding:
      4px 8px;

  border-radius: 999px;

  font-size: 8px;
  font-weight: 650;
}


.status-badge i {
  font-size: 8px;
}


.status-ok {
  background:
      var(--pi-success-soft);

  color:
      var(--pi-success);
}


.status-warning {
  background:
      var(--pi-warning-soft);

  color:
      var(--pi-warning);
}


.source-meta {
  display: flex;

  gap: 22px;
}


.source-meta > div {
  display: flex;

  flex-direction: column;

  align-items: flex-end;
}


.source-meta span {
  color:
      var(--pi-text-muted);

  font-size: 8px;
}


.source-meta strong {
  margin-top: 4px;

  color:
      var(--pi-text-secondary);

  font-size: 10px;
  font-weight: 650;
}


.validation-summary {
  display: flex;

  align-items: center;

  min-height: 102px;

  margin-bottom: 0;

  padding: 17px;

  gap: 12px;
}


.validation-summary.valid {
  border-color:
      #bbf7d0;

  background:
      linear-gradient(
          135deg,
          #ffffff,
          #f7fff9
      );
}


.validation-summary.invalid {
  border-color:
      #fde68a;

  background:
      linear-gradient(
          135deg,
          #ffffff,
          #fffdf5
      );
}


.validation-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 36px;
  height: 36px;

  border-radius: 50%;
}


.valid
.validation-icon {
  background:
      var(--pi-success-soft);

  color:
      var(--pi-success);
}


.invalid
.validation-icon {
  background:
      var(--pi-warning-soft);

  color:
      var(--pi-warning);
}


.validation-icon i {
  font-size: 13px;
}


.validation-summary > div:last-child {
  display: flex;

  flex-direction: column;
}


.validation-summary strong {
  color:
      var(--pi-text);

  font-size: 11px;
}


.validation-summary span {
  margin-top: 3px;

  color:
      var(--pi-text-muted);

  font-size: 9px;
}


/* =========================================================
   METRICS
   ========================================================= */

.metrics-grid {
  display: grid;

  grid-template-columns:
    repeat(
      5,
      minmax(0, 1fr)
    );

  gap: 10px;

  margin-bottom: 16px;
}


.metric-card {
  display: flex;

  align-items: center;

  min-width: 0;

  padding: 13px;

  gap: 10px;

  border:
      1px solid var(--pi-border);

  border-radius:
      var(--pi-radius-md);

  background:
      var(--pi-surface);

  box-shadow:
      var(--pi-shadow-sm);
}


.metric-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 32px;
  height: 32px;

  border-radius: 8px;

  background:
      var(--pi-surface-muted);

  color:
      var(--pi-text-secondary);
}


.metric-icon.recognized {
  background:
      var(--pi-success-soft);

  color:
      var(--pi-success);
}


.metric-icon i {
  font-size: 11px;
}


.metric-card > div:last-child {
  min-width: 0;
}


.metric-card span {
  display: block;

  color:
      var(--pi-text-muted);

  font-size: 8px;
  font-weight: 550;
}


.metric-card strong {
  display: block;

  margin-top: 4px;

  overflow: hidden;

  color:
      var(--pi-text);

  font-size: 15px;
  font-weight: 700;

  text-overflow: ellipsis;

  white-space: nowrap;
}


.metric-card
.metric-text {
  font-size: 11px;
}


/* =========================================================
   VALIDATION
   ========================================================= */

.validation-content {
  padding: 16px 18px;
}


.success-message {
  display: flex;

  align-items: center;

  gap: 10px;

  margin-bottom: 14px;

  padding: 11px 12px;

  border:
      1px solid #bbf7d0;

  border-radius:
      var(--pi-radius-sm);

  background:
      var(--pi-success-soft);

  color:
      var(--pi-success);
}


.success-message > i {
  font-size: 13px;
}


.success-message > div {
  display: flex;

  flex-direction: column;
}


.success-message strong {
  font-size: 10px;
}


.success-message span {
  margin-top: 2px;

  font-size: 9px;
}


.validation-stats {
  display: grid;

  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );

  gap: 10px;
}


.validation-stats > div {
  padding: 10px 11px;

  border:
      1px solid var(--pi-border);

  border-radius:
      var(--pi-radius-sm);

  background:
      var(--pi-surface-soft);
}


.validation-stats span {
  display: block;

  color:
      var(--pi-text-muted);

  font-size: 8px;
}


.validation-stats strong {
  display: block;

  margin-top: 4px;

  color:
      var(--pi-text);

  font-size: 12px;
}


.code-value {
  font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;

  font-size: 9px !important;
}


.validation-errors {
  padding: 16px 18px;
}


.issue-block {
  padding: 12px;

  border:
      1px solid #fde68a;

  border-radius:
      var(--pi-radius-sm);

  background:
      var(--pi-warning-soft);
}


.issue-title {
  display: flex;

  align-items: center;

  gap: 6px;

  color:
      #92400e;

  font-size: 10px;
  font-weight: 650;
}


.issue-chips {
  display: flex;

  flex-wrap: wrap;

  gap: 6px;

  margin-top: 9px;
}


.issue-chips span {
  padding:
      4px 7px;

  border-radius: 6px;

  background: #ffffff;

  color: #92400e;

  font-size: 8px;
  font-weight: 600;
}


.issue-list {
  margin-top: 10px;
}


.issue-list p {
  display: flex;

  align-items: flex-start;

  gap: 6px;

  margin:
      0 0 5px;

  color:
      var(--pi-danger);

  font-size: 9px;
}


/* =========================================================
   DETAILS GRID
   ========================================================= */

.details-grid {
  display: grid;

  grid-template-columns:
    minmax(0, 1.4fr)
    minmax(300px, 0.8fr);

  gap: 14px;
}


.count-badge {
  display: inline-flex;

  align-items: center;

  min-height: 25px;

  padding:
      4px 8px;

  border-radius: 999px;

  background:
      var(--pi-primary-soft);

  color:
      var(--pi-primary);

  font-size: 8px;
  font-weight: 650;
}


.count-badge.neutral {
  background:
      var(--pi-surface-muted);

  color:
      var(--pi-text-secondary);
}


.table-wrapper {
  width: 100%;

  overflow-x: auto;
}


.mapping-table {
  max-height: 405px;

  overflow-y: auto;
}


table {
  width: 100%;

  border-collapse: collapse;
}


th {
  position: sticky;

  top: 0;

  z-index: 2;

  padding:
      9px 11px;

  border-bottom:
      1px solid var(--pi-border);

  background:
      var(--pi-surface-soft);

  color:
      var(--pi-text-muted);

  text-align: left;

  font-size: 8px;
  font-weight: 650;

  letter-spacing: 0.025em;

  text-transform: uppercase;
}


td {
  padding:
      9px 11px;

  border-bottom:
      1px solid #edf2f7;

  color:
      var(--pi-text-secondary);

  font-size: 9px;

  line-height: 1.4;

  vertical-align: middle;
}


tbody tr {
  transition:
      background
      var(--pi-transition);
}


tbody tr:hover {
  background:
      #fafcff;
}


tbody tr:last-child td {
  border-bottom: none;
}


.excel-column {
  color:
      var(--pi-text);

  font-weight: 550;
}


.canonical-field {
  padding:
      3px 5px;

  border-radius: 5px;

  background:
      var(--pi-surface-muted);

  color:
      var(--pi-text-secondary);

  font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;

  font-size: 8px;
}


.field-type {
  display: inline-flex;

  padding:
      4px 6px;

  border-radius: 999px;

  background:
      var(--pi-surface-muted);

  color:
      var(--pi-text-muted);

  font-size: 7px;
  font-weight: 650;
}


.field-type.required {
  background:
      var(--pi-warning-soft);

  color:
      var(--pi-warning);
}


.unused-body {
  padding: 15px 17px 17px;
}


.unused-info {
  display: flex;

  align-items: flex-start;

  gap: 7px;

  margin-bottom: 12px;

  color:
      var(--pi-text-muted);

  font-size: 9px;

  line-height: 1.45;
}


.unused-info i {
  margin-top: 1px;

  color:
      var(--pi-primary);

  font-size: 10px;
}


.chips {
  display: flex;

  flex-wrap: wrap;

  gap: 6px;
}


.chip {
  padding:
      5px 7px;

  border:
      1px solid var(--pi-border);

  border-radius: 6px;

  background:
      var(--pi-surface-soft);

  color:
      var(--pi-text-secondary);

  font-size: 8px;
}


.empty-success {
  display: flex;

  align-items: center;

  gap: 7px;

  color:
      var(--pi-success);

  font-size: 9px;
  font-weight: 600;
}


/* =========================================================
   PREVIEW
   ========================================================= */

.preview-panel {
  margin-top: 0;
}


.heading-with-badge {
  display: flex;

  align-items: center;

  gap: 7px;
}


.heading-with-badge h3 {
  margin: 0;
}


.preview-table {
  min-width: 900px;
}


.preview-table th {
  position: static;
}


.id-value {
  color:
      var(--pi-primary);

  font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;

  font-size: 8px;
  font-weight: 650;

  white-space: nowrap;
}


.requirement-cell {
  min-width: 230px;

  color:
      var(--pi-text);

  font-weight: 500;
}


.neutral-tag {
  display: inline-flex;

  padding:
      3px 6px;

  border-radius: 999px;

  background:
      var(--pi-surface-muted);

  color:
      var(--pi-text-secondary);

  font-size: 8px;

  white-space: nowrap;
}


/* =========================================================
   UPDATE COMPARISON
   ========================================================= */

.update-panel {
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid #bfdbfe;
  border-radius: var(--pi-radius-lg);
  background:
      linear-gradient(
          135deg,
          #ffffff 0%,
          #f8fbff 100%
      );
  box-shadow: var(--pi-shadow-sm);
}


.update-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 18px;
  border-bottom: 1px solid #dbeafe;
}


.update-header h3 {
  margin: 0;
  color: var(--pi-text);
  font-size: 13px;
  font-weight: 680;
}


.update-header p {
  margin: 4px 0 0;
  color: var(--pi-text-muted);
  font-size: 9px;
}


.baseline-detected {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 5px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 8px;
  font-weight: 650;
}


.comparison-metrics {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 18px;
}


.comparison-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-md);
  background: #ffffff;
}


.comparison-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}


.comparison-card.new
.comparison-icon {
  background: #ecfdf5;
  color: #16a34a;
}


.comparison-card.modified
.comparison-icon {
  background: #fff7ed;
  color: #ea580c;
}


.comparison-card.unchanged
.comparison-icon {
  background: #f1f5f9;
  color: #64748b;
}


.comparison-card.inactive
.comparison-icon {
  background: #fef2f2;
  color: #dc2626;
}


.comparison-card strong {
  display: block;
  color: var(--pi-text);
  font-size: 17px;
  font-weight: 700;
}


.comparison-card span {
  display: block;
  margin-top: 1px;
  color: var(--pi-text-muted);
  font-size: 8px;
  font-weight: 600;
}


.changes-preview {
  margin: 0 18px 14px;
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-md);
  background: #ffffff;
}


.changes-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--pi-border);
  background: var(--pi-surface-soft);
}


.changes-preview-header > div {
  display: flex;
  flex-direction: column;
}


.changes-preview-header strong {
  color: var(--pi-text);
  font-size: 9px;
}


.changes-preview-header span {
  margin-top: 2px;
  color: var(--pi-text-muted);
  font-size: 8px;
}


.changes-list {
  max-height: 310px;
  overflow-y: auto;
}


.change-row {
  display: grid;
  grid-template-columns:
    minmax(150px, 0.35fr)
    minmax(0, 1fr);
  gap: 14px;
  padding: 10px 12px;
  border-bottom: 1px solid #edf2f7;
}


.change-row:last-child {
  border-bottom: none;
}


.change-record {
  display: flex;
  flex-direction: column;
  min-width: 0;
}


.change-record strong {
  color: var(--pi-primary);
  font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  font-size: 8px;
}


.change-record span {
  margin-top: 3px;
  overflow: hidden;
  color: var(--pi-text-secondary);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.change-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}


.change-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--pi-surface-soft);
  font-size: 7px;
}


.change-chip i {
  color: var(--pi-text-muted);
  font-size: 6px;
}


.change-field {
  color: var(--pi-text-secondary);
  font-weight: 700;
}


.change-old {
  max-width: 120px;
  overflow: hidden;
  color: #b91c1c;
  text-decoration: line-through;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.change-new {
  max-width: 120px;
  overflow: hidden;
  color: #15803d;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.more-changes {
  color: var(--pi-primary);
  font-size: 7px;
  font-weight: 650;
}


.inactive-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0 18px 14px;
  padding: 9px 10px;
  border: 1px solid #fecaca;
  border-radius: var(--pi-radius-sm);
  background: #fffafa;
  color: #991b1b;
  font-size: 8px;
  line-height: 1.45;
}


.inactive-note i {
  margin-top: 1px;
  font-size: 9px;
}


.update-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-top: 1px solid #dbeafe;
}


.update-action > div {
  display: flex;
  flex-direction: column;
}


.update-action strong {
  color: var(--pi-text);
  font-size: 9px;
}


.update-action span {
  margin-top: 2px;
  color: var(--pi-text-muted);
  font-size: 8px;
}


.update-success {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 18px 16px;
  padding: 9px 10px;
  border: 1px solid #bbf7d0;
  border-radius: var(--pi-radius-sm);
  background: var(--pi-success-soft);
  color: var(--pi-success);
  font-size: 8px;
  font-weight: 600;
}


@media (max-width: 900px) {
  .comparison-metrics {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .change-row {
    grid-template-columns: 1fr;
  }
}


@media (max-width: 620px) {
  .update-header,
  .update-action {
    align-items: stretch;
    flex-direction: column;
  }

  .comparison-metrics {
    grid-template-columns: 1fr;
  }

  .primary-button {
    width: 100%;
  }
}


/* =========================================================
   BASELINE
   ========================================================= */

.baseline-card {
  display: grid;

  grid-template-columns:
    auto minmax(0, 1fr) auto;

  align-items: center;

  gap: 14px;

  margin-top: 2px;

  padding: 17px 18px;

  border:
      1px solid #bfdbfe;

  border-radius:
      var(--pi-radius-lg);

  background:
      linear-gradient(
          135deg,
          #ffffff 0%,
          #f5f9ff 100%
      );

  box-shadow:
      var(--pi-shadow-sm);
}


.baseline-card.completed {
  border-color:
      #bbf7d0;

  background:
      linear-gradient(
          135deg,
          #ffffff 0%,
          #f5fff8 100%
      );
}


.baseline-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 39px;
  height: 39px;

  border-radius: 10px;

  background:
      var(--pi-primary-soft);

  color:
      var(--pi-primary);
}


.completed
.baseline-icon {
  background:
      var(--pi-success-soft);

  color:
      var(--pi-success);
}


.baseline-icon i {
  font-size: 14px;
}


.baseline-copy h3 {
  margin:
      0 0 3px;

  color:
      var(--pi-text);

  font-size: 12px;
  font-weight: 680;
}


.baseline-copy p {
  max-width: 620px;

  margin: 0;

  color:
      var(--pi-text-muted);

  font-size: 9px;

  line-height: 1.5;
}


.inline-success {
  display: flex;

  align-items: center;

  gap: 6px;

  margin-top: 8px;

  color:
      var(--pi-success);

  font-size: 9px;
  font-weight: 600;
}


.baseline-action {
  display: flex;

  align-items: center;

  gap: 14px;
}


.baseline-count {
  display: flex;

  flex-direction: column;

  align-items: flex-end;
}


.baseline-count strong {
  color:
      var(--pi-text);

  font-size: 15px;
}


.baseline-count span {
  margin-top: 1px;

  color:
      var(--pi-text-muted);

  font-size: 8px;
}


.primary-button {
  display: inline-flex;

  align-items: center;
  justify-content: center;

  min-height: 36px;

  padding:
      0 13px;

  gap: 7px;

  border: none;

  border-radius:
      var(--pi-radius-sm);

  background:
      var(--pi-primary);

  color: #ffffff;

  font-size: 9px;
  font-weight: 650;

  cursor: pointer;

  box-shadow:
      0 4px 12px
      rgba(
          37,
          99,
          235,
          0.18
      );

  transition:
      background
      var(--pi-transition),
      transform
      var(--pi-transition),
      box-shadow
      var(--pi-transition);
}


.primary-button:hover:not(:disabled) {
  background:
      var(--pi-primary-hover);

  box-shadow:
      0 6px 16px
      rgba(
          37,
          99,
          235,
          0.23
      );

  transform:
      translateY(-1px);
}


.primary-button:disabled {
  background:
      #94a3b8;

  cursor: not-allowed;

  box-shadow: none;

  transform: none;
}


.primary-button i {
  font-size: 9px;
}


/* =========================================================
   RESPONSIVE
   ========================================================= */

@media (
max-width: 1180px
) {

  .metrics-grid {
    grid-template-columns:
      repeat(
        3,
        minmax(0, 1fr)
      );
  }


  .details-grid {
    grid-template-columns:
      1fr;
  }

}


@media (
max-width: 900px
) {

  .result-grid {
    grid-template-columns:
      1fr;
  }


  .validation-stats {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }


  .baseline-card {
    grid-template-columns:
      auto 1fr;
  }


  .baseline-action {
    grid-column:
        1 / -1;

    justify-content:
        space-between;
  }

}


@media (
max-width: 720px
) {

  .page-intro {
    flex-direction: column;
  }


  .support-badges {
    justify-content:
        flex-start;
  }


  .steps-card {
    grid-template-columns:
      1fr;

    gap: 8px;
  }


  .step-line {
    display: none;
  }


  .step-copy span {
    display: none;
  }


  .dropzone {
    align-items:
        flex-start;

    flex-wrap: wrap;
  }


  .secondary-button {
    width: 100%;
  }


  .source-header {
    align-items:
        flex-start;

    flex-direction:
        column;
  }


  .source-meta {
    width: 100%;

    justify-content:
        space-between;
  }


  .source-meta > div {
    align-items:
        flex-start;
  }


  .metrics-grid {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }


  .baseline-card {
    grid-template-columns:
      1fr;
  }


  .baseline-icon {
    display: none;
  }


  .baseline-action {
    grid-column:
        auto;

    align-items:
        stretch;

    flex-direction:
        column;
  }


  .baseline-count {
    align-items:
        flex-start;
  }


  .primary-button {
    width: 100%;
  }

}


@media (
max-width: 480px
) {

  .metrics-grid,
  .validation-stats {
    grid-template-columns:
      1fr;
  }

}


.history-panel {
  margin-top: 20px;
  padding: 18px 20px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.history-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.history-header h3 {
  margin: 2px 0 0;
  color: var(--pi-text);
  font-size: 15px;
}

.history-header p {
  margin: 4px 0 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.history-link {
  color: var(--pi-primary);
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
}
</style>
