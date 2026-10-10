<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import SelectButton from "primevue/selectbutton";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import Tag from "primevue/tag";

import {
  TIPOS_CAMBIO,
  valorLegible
} from "../../services/auditoriaService";

import type {
  CampoCambiado,
  TipoCambio
} from "../../services/auditoriaService";

import type { CodigoFuente } from "../../config/sourceSchemas";

import { useRequerimientosStore } from "../../stores/requerimientosStore";


/*
 * Lista de registros que cambiaron en una carga (o que
 * cambiarían, en la vista previa de Importaciones), con
 * el valor anterior y el nuevo de cada campo.
 */
export interface FilaCambio {
  id: string;
  tipo: TipoCambio;
  codigoFuente: CodigoFuente;
  idDocumento: string;
  idPrincipal: string;
  nombre: string;
  campos: CampoCambiado[];
}

const props = withDefaults(
    defineProps<{
      filas: FilaCambio[];
      cargando?: boolean;
      filasPorPagina?: number;
    }>(),
    {
      cargando: false,
      filasPorPagina: 10
    }
);

const requerimientosStore = useRequerimientosStore();

const busqueda = ref("");
const tiposSeleccionados = ref<TipoCambio[]>([]);
const expandidas = ref<Record<string, boolean>>({});

const opcionesTipo = computed(() =>
    (Object.keys(TIPOS_CAMBIO) as TipoCambio[])
        .map(tipo => ({
          tipo,
          etiqueta: `${TIPOS_CAMBIO[tipo].nombre} (${props.filas.filter(fila => fila.tipo === tipo).length})`
        }))
        .filter(opcion => props.filas.some(fila => fila.tipo === opcion.tipo))
);

const filasFiltradas = computed(() => {
  const termino = busqueda.value.trim().toLowerCase();

  return props.filas.filter(fila => {
    if (tiposSeleccionados.value.length && !tiposSeleccionados.value.includes(fila.tipo)) {
      return false;
    }

    if (!termino) {
      return true;
    }

    return [
      fila.idPrincipal,
      fila.nombre,
      ...fila.campos.map(campo => campo.etiqueta)
    ]
        .join(" ")
        .toLowerCase()
        .includes(termino);
  });
});

function requerimientoDe(idDocumento: string) {
  return requerimientosStore.porDocumento.get(idDocumento);
}

function resumenCampos(campos: CampoCambiado[]): string {
  const nombres = campos.slice(0, 3).map(campo => campo.etiqueta).join(", ");

  return campos.length > 3
      ? `${nombres} y ${campos.length - 3} más`
      : nombres;
}
</script>


<template>
  <div class="cambios-tabla">

    <div class="toolbar">
      <IconField class="buscador">
        <InputIcon class="pi pi-search" />
        <InputText
            v-model="busqueda"
            type="search"
            size="small"
            placeholder="Buscar por ID, nombre o campo..."
            fluid
        />
      </IconField>

      <SelectButton
          v-if="opcionesTipo.length > 1"
          v-model="tiposSeleccionados"
          :options="opcionesTipo"
          option-label="etiqueta"
          option-value="tipo"
          multiple
          size="small"
          aria-label="Filtrar por tipo de cambio"
      />
    </div>

    <DataTable
        v-model:expanded-rows="expandidas"
        :value="filasFiltradas"
        :loading="cargando"
        data-key="id"
        paginator
        :rows="filasPorPagina"
        :rows-per-page-options="[10, 25, 50]"
        paginator-template="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        current-page-report-template="{first}–{last} de {totalRecords}"
        size="small"
        striped-rows
        row-hover
        class="tabla"
    >
      <template #empty>
        <div class="vacio">
          {{ filas.length ? "Ningún cambio coincide con la búsqueda." : "No hay cambios para mostrar." }}
        </div>
      </template>

      <Column expander style="width: 2.5rem" />

      <Column field="tipo" header="Tipo" sortable style="width: 8rem">
        <template #body="{ data }">
          <Tag
              :value="TIPOS_CAMBIO[data.tipo as TipoCambio].nombre"
              :icon="TIPOS_CAMBIO[data.tipo as TipoCambio].icono"
              :severity="TIPOS_CAMBIO[data.tipo as TipoCambio].severidad"
              class="tag"
          />
        </template>
      </Column>

      <Column field="idPrincipal" header="Registro" sortable>
        <template #body="{ data }">
          <div class="registro">
            <span class="fuente" :class="`source-${data.codigoFuente.toLowerCase()}`">
              {{ data.codigoFuente }}
            </span>
            <RouterLink
                v-if="requerimientoDe(data.idDocumento)"
                :to="{ name: 'requerimiento-detalle', params: { id: requerimientoDe(data.idDocumento)!.id } }"
                class="id"
                @click.stop
            >
              {{ data.idPrincipal || data.idDocumento }}
            </RouterLink>
            <span v-else class="id sin-enlace">{{ data.idPrincipal || data.idDocumento }}</span>
          </div>
          <small class="nombre">{{ data.nombre || "Sin nombre" }}</small>
        </template>
      </Column>

      <Column header="Campos que cambiaron">
        <template #body="{ data }">
          <span v-if="data.campos.length" class="resumen-campos">
            {{ resumenCampos(data.campos) }}
          </span>
          <span v-else class="sin-campos">
            {{ data.tipo === "NUEVO" ? "Registro nuevo" : data.tipo === "INACTIVADO" ? "Ya no aparece en el archivo" : "Sin cambios de contenido" }}
          </span>
        </template>
      </Column>

      <template #expansion="{ data }">
        <table v-if="data.campos.length" class="detalle">
          <thead>
          <tr>
            <th>Campo</th>
            <th>Valor anterior</th>
            <th />
            <th>Valor nuevo</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="campo in data.campos" :key="campo.campo">
            <td class="campo" :class="{ extra: campo.campo.startsWith('extra.') }">{{ campo.etiqueta }}</td>
            <td class="anterior">{{ valorLegible(campo.anterior) }}</td>
            <td class="flecha"><i class="pi pi-arrow-right" /></td>
            <td class="nuevo">{{ valorLegible(campo.nuevo) }}</td>
          </tr>
          </tbody>
        </table>
        <p v-else class="sin-campos detalle-vacio">
          No hay cambios de campos que mostrar para este registro.
        </p>
      </template>
    </DataTable>

  </div>
</template>


<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.buscador {
  flex: 1;
  min-width: 220px;
  max-width: 380px;
}

.tabla :deep(.p-datatable-tbody > tr > td) {
  font-size: 12px;
  vertical-align: top;
}

.tabla :deep(.p-datatable-column-title) {
  font-size: 11px;
  font-weight: 650;
}

.tag {
  font-size: 10px;
}

.registro {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fuente {
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
}

.source-dt { background: #eff6ff; color: #2563eb; }
.source-cq { background: #f5f3ff; color: #7c3aed; }
.source-ls { background: #fff7ed; color: #c2410c; }

.id {
  color: var(--pi-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 650;
  text-decoration: none;
}

.id:hover {
  text-decoration: underline;
}

.id.sin-enlace {
  color: var(--pi-text-secondary);
}

.nombre {
  display: block;
  max-width: 420px;
  overflow: hidden;
  margin-top: 2px;
  color: var(--pi-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resumen-campos {
  color: var(--pi-text-secondary);
}

.sin-campos {
  color: var(--pi-text-muted);
  font-style: italic;
}

.detalle {
  width: 100%;
  max-width: 980px;
  margin: 4px 0 8px 40px;
  border-collapse: collapse;
  font-size: 12px;
}

.detalle th {
  padding: 6px 8px;
  color: var(--pi-text-muted);
  font-size: 10px;
  font-weight: 650;
  text-align: left;
  text-transform: uppercase;
}

.detalle td {
  padding: 6px 8px;
  border-top: 1px solid var(--pi-surface-muted);
  vertical-align: top;
  word-break: break-word;
}

.detalle .campo {
  width: 22%;
  color: var(--pi-text);
  font-weight: 600;
}

.detalle .campo.extra {
  font-style: italic;
  font-weight: 500;
}

.detalle .anterior {
  width: 36%;
  color: var(--pi-danger);
  text-decoration: line-through;
  text-decoration-color: rgba(220, 38, 38, 0.35);
}

.detalle .nuevo {
  width: 36%;
  color: var(--pi-success);
}

.detalle .flecha {
  width: 24px;
  color: var(--pi-text-muted);
}

.detalle-vacio {
  margin: 6px 0 8px 40px;
  font-size: 12px;
}

.vacio {
  padding: 24px;
  color: var(--pi-text-muted);
  font-size: 12px;
  text-align: center;
}
</style>
