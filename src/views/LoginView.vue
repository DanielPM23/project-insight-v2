<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";

import { useAuthStore } from "../stores/authStore";
import { mensajeErrorAuth } from "../services/usuariosService";


const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const {
  usuario,
  perfil,
  tieneAcceso,
  puedeSerAdminInicial,
  errorPerfil
} = storeToRefs(auth);

const email = ref("");
const password = ref("");
const enviando = ref(false);
const error = ref("");
const aviso = ref("");


/*
 * Con sesión pero sin perfil activo: se muestra por
 * qué no puede entrar en vez del formulario.
 */
const sinAcceso = computed(
    () => usuario.value !== null && !tieneAcceso.value
);


function irALaApp() {
  const destino =
      typeof route.query.redirect === "string" &&
      route.query.redirect.startsWith("/")
          ? route.query.redirect
          : "/dashboard";

  router.replace(destino);
}


watch(
    tieneAcceso,
    valor => {
      if (valor) {
        irALaApp();
      }
    },
    { immediate: true }
);


async function ejecutar(accion: () => Promise<void>) {
  enviando.value = true;
  error.value = "";
  aviso.value = "";

  try {
    await accion();
  } catch (e) {
    console.error(e);
    error.value = mensajeErrorAuth(e);
  } finally {
    enviando.value = false;
  }
}


function ingresar() {
  ejecutar(() =>
      auth.iniciarSesion(email.value, password.value)
  );
}


function restablecer() {
  if (!email.value.trim()) {
    error.value = "Escribe tu correo para enviarte el enlace.";
    return;
  }

  ejecutar(async () => {
    await auth.restablecerPassword(email.value);
    aviso.value = "Te enviamos un correo para cambiar tu contraseña.";
  });
}


function configurarAdmin() {
  ejecutar(() => auth.convertirseEnAdminInicial());
}


function salir() {
  ejecutar(() => auth.cerrarSesion());
}
</script>


<template>
  <main class="login-page">

    <section class="login-card">

      <div class="brand">
        <div class="logo-mark">PI</div>
        <div>
          <strong>Project Insight</strong>
          <span>Management Platform</span>
        </div>
      </div>


      <!-- Con sesión pero sin acceso -->
      <template v-if="sinAcceso">

        <h1>
          {{ puedeSerAdminInicial ? "Configura el administrador" : "Sin acceso todavía" }}
        </h1>

        <p
            v-if="errorPerfil"
            class="texto"
        >
          {{ errorPerfil }}
        </p>

        <p
            v-else-if="puedeSerAdminInicial"
            class="texto"
        >
          Aún no hay ningún administrador. Como eres la primera
          persona en entrar con <strong>{{ usuario?.email }}</strong>,
          puedes quedar como administrador para cargar los Excels y
          dar acceso a los demás.
        </p>

        <p
            v-else-if="perfil && !perfil.activo"
            class="texto"
        >
          Tu cuenta <strong>{{ usuario?.email }}</strong> está
          desactivada. Pide a un administrador que la vuelva a activar.
        </p>

        <p
            v-else
            class="texto"
        >
          La cuenta <strong>{{ usuario?.email }}</strong> no tiene un
          rol asignado. Pide a un administrador que te dé acceso.
        </p>

        <div
            v-if="error"
            class="mensaje error"
            role="alert"
        >
          {{ error }}
        </div>

        <button
            v-if="puedeSerAdminInicial"
            class="boton primario"
            type="button"
            :disabled="enviando"
            @click="configurarAdmin"
        >
          <i :class="enviando ? 'pi pi-spin pi-spinner' : 'pi pi-shield'" />
          Quedar como administrador
        </button>

        <button
            class="boton secundario"
            type="button"
            :disabled="enviando"
            @click="salir"
        >
          Usar otra cuenta
        </button>

      </template>


      <!-- Formulario -->
      <form
          v-else
          @submit.prevent="ingresar"
      >
        <h1>Inicia sesión</h1>

        <p class="texto">
          Usa la cuenta que te dio el administrador.
        </p>

        <label>
          Correo
          <input
              v-model="email"
              type="email"
              autocomplete="username"
              required
          />
        </label>

        <label>
          Contraseña
          <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
          />
        </label>

        <div
            v-if="error"
            class="mensaje error"
            role="alert"
        >
          {{ error }}
        </div>

        <div
            v-if="aviso"
            class="mensaje ok"
        >
          {{ aviso }}
        </div>

        <button
            class="boton primario"
            type="submit"
            :disabled="enviando"
        >
          <i :class="enviando ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'" />
          Ingresar
        </button>

        <button
            class="enlace"
            type="button"
            :disabled="enviando"
            @click="restablecer"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </form>

    </section>

  </main>
</template>


<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px 16px;
  background: var(--pi-bg);
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: 28px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-lg);
  background: var(--pi-surface);
  box-shadow: var(--pi-shadow-sm);
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 24px;
}

.brand strong {
  display: block;
  color: var(--pi-text);
  font-size: 14px;
}

.brand span {
  color: var(--pi-text-muted);
  font-size: 10px;
}

.logo-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
}

h1 {
  margin: 0;
  color: var(--pi-text);
  font-size: 18px;
  font-weight: 700;
}

.texto {
  margin: 6px 0 18px;
  color: var(--pi-text-secondary);
  font-size: 12px;
  line-height: 1.5;
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

input {
  height: 38px;
  padding: 0 11px;
  border: 1px solid var(--pi-border);
  border-radius: var(--pi-radius-sm);
  background: var(--pi-surface);
  color: var(--pi-text);
  font: inherit;
  font-size: 13px;
  font-weight: 400;
}

input:focus {
  border-color: var(--pi-primary);
  outline: 2px solid var(--pi-primary-soft);
}

.mensaje {
  margin-bottom: 12px;
  padding: 9px 12px;
  border-radius: var(--pi-radius-sm);
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

.boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 38px;
  margin-top: 4px;
  border-radius: var(--pi-radius-sm);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.boton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.boton.primario {
  border: none;
  background: var(--pi-primary);
  color: #ffffff;
}

.boton.primario:hover:not(:disabled) {
  background: var(--pi-primary-hover);
}

.boton.secundario {
  margin-top: 8px;
  border: 1px solid var(--pi-border);
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
}

.enlace {
  margin-top: 12px;
  border: none;
  background: none;
  color: var(--pi-primary);
  font-size: 11px;
  cursor: pointer;
}
</style>
