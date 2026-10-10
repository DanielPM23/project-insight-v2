<script setup lang="ts">
import { RouterLink } from "vue-router";
import Tag from "primevue/tag";

import {
  TIPOS_CAMBIO,
  valorLegible
} from "../../services/auditoriaService";

import type { CambioRegistro } from "../../services/auditoriaService";
import { formatearFechaHora } from "../../utils/fechas";


/*
 * Historia de cambios de un requerimiento, de la más
 * reciente a la más antigua.
 */
defineProps<{
  cambios: CambioRegistro[];
  cargando?: boolean;
}>();
</script>


<template>
  <div class="linea-tiempo">

    <p v-if="cargando" class="vacio">
      <i class="pi pi-spin pi-spinner" /> Cargando historial…
    </p>

    <p v-else-if="cambios.length === 0" class="vacio">
      Este requerimiento no tiene cambios registrados desde su base inicial.
      Los cambios aparecen aquí a partir de la siguiente actualización de cada Excel.
    </p>

    <ol v-else>
      <li
          v-for="cambio in cambios"
          :key="cambio.id"
          class="evento"
      >
        <span class="punto" :class="cambio.tipo.toLowerCase()">
          <i :class="TIPOS_CAMBIO[cambio.tipo].icono" />
        </span>

        <div class="contenido">
          <div class="cabecera">
            <strong>{{ formatearFechaHora(cambio.fecha) || "Fecha pendiente" }}</strong>
            <span class="fuente" :class="`source-${cambio.codigoFuente.toLowerCase()}`">{{ cambio.codigoFuente }}</span>
            <Tag
                :value="TIPOS_CAMBIO[cambio.tipo].nombre"
                :severity="TIPOS_CAMBIO[cambio.tipo].severidad"
                class="tag"
            />
            <span class="registro">{{ cambio.clave }}</span>
            <span v-if="cambio.usuario?.email" class="usuario">· {{ cambio.usuario.email }}</span>
            <RouterLink
                :to="{ name: 'auditoria', query: { carga: cambio.idCarga } }"
                class="ver-carga"
            >
              Ver carga
            </RouterLink>
          </div>

          <table v-if="cambio.campos.length" class="campos">
            <tr v-for="campo in cambio.campos" :key="campo.campo">
              <td class="campo">{{ campo.etiqueta }}</td>
              <td class="anterior">{{ valorLegible(campo.anterior) }}</td>
              <td class="flecha"><i class="pi pi-arrow-right" /></td>
              <td class="nuevo">{{ valorLegible(campo.nuevo) }}</td>
            </tr>
          </table>

          <p v-else class="nota">
            {{
              cambio.tipo === "NUEVO"
                  ? "Apareció por primera vez en el archivo."
                  : cambio.tipo === "INACTIVADO"
                      ? "Dejó de aparecer en el archivo y se marcó como inactivo."
                      : "Volvió a aparecer en el archivo sin cambios de contenido."
            }}
          </p>
        </div>
      </li>
    </ol>

  </div>
</template>


<style scoped>
.vacio {
  margin: 0;
  padding: 18px 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}

ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.evento {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 18px;
}

.evento:not(:last-child)::before {
  content: "";
  position: absolute;
  top: 26px;
  bottom: 0;
  left: 12px;
  width: 2px;
  background: var(--pi-border);
}

.punto {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--pi-surface-muted);
  color: var(--pi-text-secondary);
  font-size: 11px;
}

.punto.nuevo { background: var(--pi-success-soft); color: var(--pi-success); }
.punto.modificado { background: var(--pi-primary-soft); color: var(--pi-primary); }
.punto.reactivado { background: var(--pi-warning-soft); color: var(--pi-warning); }

.contenido {
  flex: 1;
  min-width: 0;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}

.cabecera strong {
  color: var(--pi-text);
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

.tag {
  font-size: 10px;
}

.registro {
  color: var(--pi-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.usuario {
  color: var(--pi-text-muted);
  font-size: 11px;
}

.ver-carga {
  margin-left: auto;
  color: var(--pi-primary);
  font-size: 11px;
  text-decoration: none;
}

.campos {
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-size: 12px;
}

.campos td {
  padding: 5px 8px;
  border-top: 1px solid var(--pi-surface-muted);
  vertical-align: top;
  word-break: break-word;
}

.campos .campo {
  width: 24%;
  color: var(--pi-text);
  font-weight: 600;
}

.campos .anterior {
  width: 36%;
  color: var(--pi-danger);
  text-decoration: line-through;
  text-decoration-color: rgba(220, 38, 38, 0.35);
}

.campos .nuevo {
  width: 36%;
  color: var(--pi-success);
}

.campos .flecha {
  width: 20px;
  color: var(--pi-text-muted);
}

.nota {
  margin: 6px 0 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}
</style>
