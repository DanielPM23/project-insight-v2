<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "../../stores/authStore";

defineProps<{
  colapsado: boolean;
}>();

const auth = useAuthStore();

const opcionesPrincipal = [
  { nombre: "Dashboard", ruta: "/dashboard", icono: "pi pi-chart-bar" },
  { nombre: "Requerimientos", ruta: "/requerimientos", icono: "pi pi-list" },
  { nombre: "Importaciones", ruta: "/importaciones", icono: "pi pi-upload", soloAdmin: true },
  { nombre: "Planificación", ruta: "/planificacion", icono: "pi pi-calendar" },
  { nombre: "Reportes", ruta: "/reportes", icono: "pi pi-chart-line" },
  { nombre: "Auditoría", ruta: "/auditoria", icono: "pi pi-shield" }
];

const opcionesGestion = [
  { nombre: "Usuarios", ruta: "/usuarios", icono: "pi pi-users", soloAdmin: true },
  { nombre: "Configuración", ruta: "/configuracion", icono: "pi pi-cog", soloAdmin: true }
];

/*
 * Los usuarios de consulta no ven las opciones de carga
 * ni de administración.
 */
function visibles<T extends { soloAdmin?: boolean }>(opciones: T[]): T[] {
  return opciones.filter(item => !item.soloAdmin || auth.esAdmin);
}

const menuPrincipal = computed(() => visibles(opcionesPrincipal));
const menuGestion = computed(() => visibles(opcionesGestion));
</script>

<template>
  <aside
      class="sidebar"
      :class="{ colapsado }"
  >

    <div class="sidebar-logo">
      <div class="logo-mark">PI</div>

      <div
          v-if="!colapsado"
          class="logo-copy"
      >
        <strong>Project Insight</strong>
        <span>Management Platform</span>
      </div>
    </div>

    <nav class="sidebar-nav">

      <div
          v-if="!colapsado"
          class="nav-label"
      >
        PRINCIPAL
      </div>

      <RouterLink
          v-for="item in menuPrincipal"
          :key="item.ruta"
          :to="item.ruta"
          class="nav-item"
          :title="colapsado ? item.nombre : undefined"
      >
        <div class="nav-icon">
          <i :class="item.icono" />
        </div>

        <span
            v-if="!colapsado"
            class="nav-text"
        >
          {{ item.nombre }}
        </span>
      </RouterLink>

      <template v-if="menuGestion.length">
      <div class="nav-divider" />

      <div
          v-if="!colapsado"
          class="nav-label"
      >
        GESTIÓN
      </div>

      <RouterLink
          v-for="item in menuGestion"
          :key="item.ruta"
          :to="item.ruta"
          class="nav-item"
          :title="colapsado ? item.nombre : undefined"
      >
        <div class="nav-icon">
          <i :class="item.icono" />
        </div>

        <span
            v-if="!colapsado"
            class="nav-text"
        >
          {{ item.nombre }}
        </span>
      </RouterLink>
      </template>

    </nav>

    <div class="sidebar-footer">
      <div class="status-dot" />

      <div
          v-if="!colapsado"
          class="footer-copy"
      >
        <strong>Project Insight V2</strong>
        <span>Entorno activo</span>
      </div>
    </div>

  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;

  display: flex;
  flex-direction: column;

  width: var(--pi-sidebar-width);
  background: var(--pi-sidebar-bg);

  border-right: 1px solid rgba(255, 255, 255, 0.06);

  transition: width var(--pi-transition);
}

.sidebar.colapsado {
  width: var(--pi-sidebar-collapsed-width);
}

.sidebar-logo {
  display: flex;
  align-items: center;

  height: var(--pi-topbar-height);

  padding: 0 16px;
  gap: 11px;

  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.logo-mark {
  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 36px;
  height: 36px;

  border-radius: 10px;

  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #ffffff;

  font-size: 12px;
  font-weight: 800;

  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.24);
}

.logo-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.logo-copy strong {
  color: #ffffff;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}

.logo-copy span {
  margin-top: 2px;
  color: #64748b;
  font-size: 9px;
  font-weight: 500;
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 10px;
  overflow-y: auto;
}

.nav-label {
  margin: 8px 10px 7px;
  color: #64748b;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.nav-item {
  position: relative;

  display: flex;
  align-items: center;

  min-height: 42px;

  margin-bottom: 3px;
  padding: 0 10px;
  gap: 10px;

  border-radius: 9px;

  color: var(--pi-sidebar-text);

  transition:
      background var(--pi-transition),
      color var(--pi-transition);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.055);
  color: #e2e8f0;
}

.nav-item.router-link-active {
  background: var(--pi-sidebar-active);
  color: var(--pi-sidebar-text-active);
}

.nav-item.router-link-active::before {
  content: "";

  position: absolute;
  left: -10px;

  width: 3px;
  height: 22px;

  border-radius: 0 3px 3px 0;
  background: #3b82f6;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 24px;
  height: 24px;
}

.nav-icon i {
  font-size: 15px;
}

.nav-text {
  overflow: hidden;
  font-size: 12px;
  font-weight: 520;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-divider {
  height: 1px;
  margin: 16px 8px;
  background: rgba(255, 255, 255, 0.07);
}

.sidebar-footer {
  display: flex;
  align-items: center;

  min-height: 58px;

  padding: 12px 16px;
  gap: 10px;

  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.status-dot {
  flex-shrink: 0;

  width: 8px;
  height: 8px;

  border-radius: 50%;
  background: #22c55e;

  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.08);
}

.footer-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.footer-copy strong {
  color: #cbd5e1;
  font-size: 10px;
  font-weight: 600;
}

.footer-copy span {
  margin-top: 2px;
  color: #64748b;
  font-size: 9px;
}

.sidebar.colapsado .sidebar-logo,
.sidebar.colapsado .sidebar-footer {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}

.sidebar.colapsado .nav-item {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}
</style>
