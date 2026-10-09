<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import { useAuthStore } from "../stores/authStore";

import {
  actualizarUsuario,
  crearUsuario,
  listarUsuarios,
  mensajeErrorAuth,
  ROLES
} from "../services/usuariosService";

import type {
  PerfilUsuario,
  Rol
} from "../services/usuariosService";


const auth = useAuthStore();

const usuarios = ref<PerfilUsuario[]>([]);
const cargando = ref(false);
const guardando = ref("");
const error = ref("");
const aviso = ref("");

const nuevo = reactive({
  nombre: "",
  email: "",
  password: "",
  rol: "consulta" as Rol
});


async function cargar() {
  cargando.value = true;
  error.value = "";

  try {
    usuarios.value = await listarUsuarios();
  } catch (e) {
    error.value = mensajeErrorAuth(e);
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);


function esYo(item: PerfilUsuario): boolean {
  return item.uid === auth.usuario?.uid;
}


async function crear() {
  guardando.value = "nuevo";
  error.value = "";
  aviso.value = "";

  try {
    const perfil =
        await crearUsuario(
            { ...nuevo },
            auth.usuario?.uid ?? ""
        );

    aviso.value =
        `Se creó la cuenta de ${perfil.email}. ` +
        "Compártele la contraseña temporal; puede cambiarla con «¿Olvidaste tu contraseña?».";

    nuevo.nombre = "";
    nuevo.email = "";
    nuevo.password = "";
    nuevo.rol = "consulta";

    await cargar();
  } catch (e) {
    error.value = mensajeErrorAuth(e);
  } finally {
    guardando.value = "";
  }
}


async function cambiar(
    item: PerfilUsuario,
    cambios: Partial<Pick<PerfilUsuario, "rol" | "activo">>
) {
  guardando.value = item.uid;
  error.value = "";
  aviso.value = "";

  try {
    await actualizarUsuario(item.uid, cambios);
    Object.assign(item, cambios);
  } catch (e) {
    error.value = mensajeErrorAuth(e);
    await cargar();
  } finally {
    guardando.value = "";
  }
}


function alCambiarRol(item: PerfilUsuario, evento: Event) {
  cambiar(item, {
    rol: (evento.target as HTMLSelectElement).value as Rol
  });
}
</script>


<template>
  <section class="usuarios-page">

    <div class="page-intro">
      <div class="eyebrow">
        <i class="pi pi-users" />
        Accesos
      </div>
      <h2>Usuarios</h2>
      <p>
        Los <strong>administradores</strong> cargan los Excels y dan acceso.
        Los usuarios de <strong>consulta</strong> solo ven Dashboard y Requerimientos.
      </p>
    </div>


    <div
        v-if="error"
        class="mensaje error"
        role="alert"
    >
      <i class="pi pi-exclamation-triangle" />
      {{ error }}
    </div>

    <div
        v-if="aviso"
        class="mensaje ok"
    >
      <i class="pi pi-check-circle" />
      {{ aviso }}
    </div>


    <div class="layout">

      <form
          class="panel"
          @submit.prevent="crear"
      >
        <h3>Nuevo usuario</h3>

        <label>
          Nombre
          <input
              v-model="nuevo.nombre"
              type="text"
              required
          />
        </label>

        <label>
          Correo
          <input
              v-model="nuevo.email"
              type="email"
              autocomplete="off"
              required
          />
        </label>

        <label>
          Contraseña temporal
          <input
              v-model="nuevo.password"
              type="text"
              minlength="6"
              autocomplete="new-password"
              required
          />
        </label>

        <label>
          Rol
          <select v-model="nuevo.rol">
            <option
                v-for="rol in ROLES"
                :key="rol.valor"
                :value="rol.valor"
            >
              {{ rol.nombre }}: {{ rol.descripcion }}
            </option>
          </select>
        </label>

        <button
            class="boton"
            type="submit"
            :disabled="guardando === 'nuevo'"
        >
          <i :class="guardando === 'nuevo' ? 'pi pi-spin pi-spinner' : 'pi pi-user-plus'" />
          Crear usuario
        </button>
      </form>


      <div class="panel tabla-panel">
        <div class="tabla-cabecera">
          <h3>Usuarios registrados</h3>
          <span>{{ usuarios.length }}</span>
        </div>

        <p
            v-if="cargando && !usuarios.length"
            class="vacio"
        >
          Cargando…
        </p>

        <div
            v-else
            class="tabla-scroll"
        >
          <table>
            <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Acceso</th>
            </tr>
            </thead>

            <tbody>
            <tr
                v-for="item in usuarios"
                :key="item.uid"
                :class="{ inactivo: !item.activo }"
            >
              <td>
                {{ item.nombre || "—" }}
                <span
                    v-if="esYo(item)"
                    class="chip"
                >
                  Tú
                </span>
              </td>

              <td>{{ item.email }}</td>

              <td>
                <select
                    :value="item.rol"
                    :disabled="esYo(item) || guardando === item.uid"
                    :title="esYo(item) ? 'No puedes cambiar tu propio rol' : undefined"
                    @change="alCambiarRol(item, $event)"
                >
                  <option
                      v-for="rol in ROLES"
                      :key="rol.valor"
                      :value="rol.valor"
                  >
                    {{ rol.nombre }}
                  </option>
                </select>
              </td>

              <td>
                <button
                    class="toggle"
                    type="button"
                    :class="{ activo: item.activo }"
                    :disabled="esYo(item) || guardando === item.uid"
                    @click="cambiar(item, { activo: !item.activo })"
                >
                  {{ item.activo ? "Activo" : "Desactivado" }}
                </button>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

  </section>
</template>


<style scoped>
.usuarios-page {
  width: 100%;
  padding-bottom: 32px;
}

.page-intro {
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
}

.page-intro p {
  margin: 5px 0 0;
  color: var(--pi-text-muted);
  font-size: 12px;
}

.mensaje {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border-radius: var(--pi-radius-md);
  font-size: 11px;
}

.mensaje.error {
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
}

.mensaje.ok {
  background: var(--pi-success-soft);
  color: var(--pi-success);
}

.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 18px;
  align-items: start;
}

.panel {
  padding: 18px 20px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

h3 {
  margin: 0 0 14px;
  color: var(--pi-text);
  font-size: 13px;
  font-weight: 650;
}

form {
  display: flex;
  flex-direction: column;
}

label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
  color: var(--pi-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

input,
select {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface);
  color: var(--pi-text);
  font: inherit;
  font-size: 12px;
  font-weight: 400;
}

.boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  border: none;
  border-radius: var(--pi-radius-sm);
  background: var(--pi-primary);
  color: #ffffff;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.boton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tabla-cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.tabla-cabecera span {
  color: var(--pi-text-muted);
  font-size: 11px;
}

.tabla-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th {
  padding: 8px 10px;
  border-bottom: 1px solid var(--pi-border);
  color: var(--pi-text-muted);
  font-size: 10px;
  font-weight: 650;
  text-align: left;
  text-transform: uppercase;
}

td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--pi-surface-muted);
  color: var(--pi-text);
}

tr.inactivo td {
  color: var(--pi-text-muted);
}

td select {
  height: 30px;
}

.chip {
  margin-left: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
  font-size: 9px;
  font-weight: 700;
}

.toggle {
  min-width: 92px;
  height: 28px;
  border: 1px solid var(--pi-border);
  border-radius: 999px;
  background: var(--pi-surface-muted);
  color: var(--pi-text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.toggle.activo {
  border-color: #bbf7d0;
  background: var(--pi-success-soft);
  color: var(--pi-success);
}

.toggle:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.vacio {
  color: var(--pi-text-muted);
  font-size: 12px;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
