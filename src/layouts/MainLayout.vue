<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterView, useRoute } from "vue-router";

import AppSidebar from "../components/navigation/AppSidebar.vue";
import AppTopbar from "../components/navigation/AppTopbar.vue";
import { useAlertasStore } from "../stores/alertasStore";

/*
 * Las alertas se calculan al entrar para mostrarlas en el
 * menú y la campana desde cualquier página.
 */
const alertasStore = useAlertasStore();

onMounted(() => alertasStore.cargar());

const route = useRoute();

const sidebarColapsado = ref(false);

function alternarSidebar() {
  sidebarColapsado.value = !sidebarColapsado.value;
}
</script>

<template>
  <div class="app-shell">

    <AppSidebar
        :colapsado="sidebarColapsado"
    />

    <div
        class="app-main"
        :class="{
        'sidebar-colapsado': sidebarColapsado
      }"
    >

      <AppTopbar
          @alternar-sidebar="alternarSidebar"
      />

      <main
          class="content-shell"
          :class="{ 'pantalla-completa': route.meta.pantallaCompleta }"
      >
        <div class="content-inner">
          <RouterView />
        </div>
      </main>

    </div>

  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--pi-bg);
}

.app-main {
  min-height: 100vh;
  margin-left: var(--pi-sidebar-width);
  transition: margin-left var(--pi-transition);
}

.app-main.sidebar-colapsado {
  margin-left: var(--pi-sidebar-collapsed-width);
}

.content-shell {
  min-height: calc(100vh - var(--pi-topbar-height));
  padding: 20px 22px 40px;
}

.content-inner {
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
}

/*
 * Vistas de trabajo (Requerimientos): ocupan exactamente el alto
 * visible para que solo la tabla haga scroll, no la página.
 */
.content-shell.pantalla-completa {
  height: calc(100dvh - var(--pi-topbar-height));
  min-height: 480px;
  padding: 12px 16px;
}

.pantalla-completa .content-inner {
  height: 100%;
  max-width: none;
}

@media (max-width: 900px) {
  .content-shell {
    padding: 16px;
  }

  .content-shell.pantalla-completa {
    padding: 10px;
  }
}
</style>
