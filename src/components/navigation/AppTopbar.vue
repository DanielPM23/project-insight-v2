<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../../stores/authStore";
import { ROLES } from "../../services/usuariosService";

defineEmits<{
  alternarSidebar: [];
}>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const menuAbierto = ref(false);

const nombreUsuario = computed(
    () => auth.perfil?.nombre || auth.usuario?.email || "Usuario"
);

const iniciales = computed(() =>
    nombreUsuario.value
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(parte => parte[0]?.toUpperCase())
        .join("")
);

const nombreRol = computed(
    () => ROLES.find(rol => rol.valor === auth.perfil?.rol)?.nombre ?? ""
);

async function salir() {
  menuAbierto.value = false;
  await auth.cerrarSesion();
  router.replace({ name: "login" });
}

const titulo = computed(
    () => String(route.meta.titulo ?? "Project Insight")
);

const subtitulo = computed(
    () => String(route.meta.subtitulo ?? "")
);
</script>

<template>
  <header class="topbar">

    <div class="topbar-left">

      <button
          class="icon-button menu-button"
          aria-label="Alternar menú lateral"
          title="Alternar menú lateral"
          @click="$emit('alternarSidebar')"
      >
        <i class="pi pi-bars" />
      </button>

      <div class="page-heading">
        <h1>{{ titulo }}</h1>

        <p v-if="subtitulo">
          {{ subtitulo }}
        </p>
      </div>

    </div>

    <div class="topbar-right">

      <div class="global-search">
        <i class="pi pi-search" />

        <input
            type="search"
            placeholder="Buscar en Project Insight..."
            aria-label="Búsqueda global"
        />

        <span class="shortcut">
          Ctrl K
        </span>
      </div>

      <button
          class="icon-button"
          aria-label="Notificaciones"
          title="Notificaciones"
      >
        <i class="pi pi-bell" />
      </button>

      <div class="user-menu">
        <button
            class="user-button"
            type="button"
            :aria-expanded="menuAbierto"
            @click="menuAbierto = !menuAbierto"
        >
          <div class="avatar">
            {{ iniciales }}
          </div>
          <div class="user-copy">
            <strong>{{ nombreUsuario }}</strong>
            <span>{{ nombreRol }}</span>
          </div>
          <i class="pi pi-chevron-down user-chevron" />
        </button>

        <div
            v-if="menuAbierto"
            class="user-dropdown"
        >
          <div class="user-dropdown-email">
            {{ auth.usuario?.email }}
          </div>
          <button
              type="button"
              @click="salir"
          >
            <i class="pi pi-sign-out" />
            Cerrar sesión
          </button>
        </div>
      </div>

    </div>

  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;

  display: flex;
  align-items: center;
  justify-content: space-between;

  height: var(--pi-topbar-height);

  padding: 0 24px;

  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--pi-border);

  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
}

.topbar-left {
  min-width: 0;
  gap: 13px;
}

.topbar-right {
  gap: 10px;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 36px;
  height: 36px;
  padding: 0;

  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);

  background: var(--pi-surface);
  color: var(--pi-text-secondary);

  cursor: pointer;

  transition:
      background var(--pi-transition),
      border-color var(--pi-transition),
      color var(--pi-transition);
}

.icon-button:hover {
  background: var(--pi-surface-soft);
  border-color: var(--pi-border-strong);
  color: var(--pi-text);
}

.page-heading {
  min-width: 0;
}

.page-heading h1 {
  margin: 0;

  overflow: hidden;

  color: var(--pi-text);

  font-size: 16px;
  font-weight: 680;
  letter-spacing: -0.02em;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-heading p {
  margin: 2px 0 0;

  overflow: hidden;

  color: var(--pi-text-muted);

  font-size: 10px;
  font-weight: 450;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-search {
  display: flex;
  align-items: center;

  width: 290px;
  height: 36px;

  padding: 0 10px;
  gap: 8px;

  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);

  background: var(--pi-surface-soft);

  transition:
      background var(--pi-transition),
      border-color var(--pi-transition),
      box-shadow var(--pi-transition);
}

.global-search:focus-within {
  background: var(--pi-surface);
  border-color: #93c5fd;

  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.global-search > i {
  flex-shrink: 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.global-search input {
  width: 100%;
  min-width: 0;

  border: none;
  outline: none;

  background: transparent;
  color: var(--pi-text-secondary);

  font-size: 11px;
}

.global-search input::placeholder {
  color: #a8b2c1;
}

.shortcut {
  flex-shrink: 0;

  padding: 3px 5px;

  border: 1px solid var(--pi-border);
  border-radius: 5px;

  background: var(--pi-surface);

  color: var(--pi-text-muted);

  font-size: 9px;
  font-weight: 600;
}

.user-menu {
  position: relative;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  padding: 6px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-md);
  background: var(--pi-surface);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
}

.user-dropdown-email {
  padding: 6px 8px 8px;
  border-bottom: 1px solid var(--pi-surface-muted);
  color: var(--pi-text-muted);
  font-size: 10px;
}

.user-dropdown button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 4px;
  padding: 8px;
  border: none;
  border-radius: var(--pi-radius-sm);
  background: none;
  color: var(--pi-text-secondary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.user-dropdown button:hover {
  background: var(--pi-surface-soft);
  color: var(--pi-danger);
}

.user-button {
  display: flex;
  align-items: center;

  height: 40px;

  padding: 0 8px 0 5px;
  gap: 8px;

  border: 1px solid transparent;
  border-radius: 9px;

  background: transparent;

  cursor: pointer;

  transition:
      background var(--pi-transition),
      border-color var(--pi-transition);
}

.user-button:hover {
  background: var(--pi-surface-soft);
  border-color: var(--pi-border);
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 31px;
  height: 31px;

  border-radius: 50%;

  background: var(--pi-primary-soft);
  color: var(--pi-primary);

  font-size: 10px;
  font-weight: 700;
}

.user-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;
}

.user-copy strong {
  color: var(--pi-text-secondary);
  font-size: 10px;
  font-weight: 650;
}

.user-copy span {
  margin-top: 1px;
  color: var(--pi-text-muted);
  font-size: 8px;
}

.user-chevron {
  margin-left: 2px;
  color: var(--pi-text-muted);
  font-size: 8px;
}

@media (max-width: 1050px) {
  .global-search {
    width: 220px;
  }
}

@media (max-width: 860px) {
  .global-search {
    display: none;
  }
}

@media (max-width: 640px) {
  .topbar {
    padding: 0 14px;
  }

  .page-heading p {
    display: none;
  }

  .user-copy,
  .user-chevron {
    display: none;
  }

  .user-button {
    padding: 0 3px;
    border: none;
  }
}
</style>
