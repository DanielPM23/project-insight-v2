<script setup lang="ts">
import { ref } from "vue";
import { RouterView } from "vue-router";

import AppSidebar from "../components/navigation/AppSidebar.vue";
import AppTopbar from "../components/navigation/AppTopbar.vue";

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

      <main class="content-shell">
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

@media (max-width: 900px) {
  .content-shell {
    padding: 16px;
  }
}
</style>
