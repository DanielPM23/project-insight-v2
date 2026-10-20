import { ref, watch } from "vue";

/*
 * Tema claro / oscuro.
 *
 * La elección se guarda en este navegador. Sin elección,
 * se sigue la preferencia del sistema operativo. index.html
 * aplica la misma regla antes de cargar la app para que la
 * pantalla no parpadee en blanco.
 */

export type Tema = "claro" | "oscuro";

const CLAVE = "pi-tema";
const CLASE = "app-dark";

function temaGuardado(): Tema | null {
    try {
        const valor = localStorage.getItem(CLAVE);
        return valor === "claro" || valor === "oscuro" ? valor : null;
    } catch {
        return null;
    }
}

function temaDelSistema(): Tema {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

export const tema = ref<Tema>(temaGuardado() ?? temaDelSistema());

watch(
    tema,
    valor => document.documentElement.classList.toggle(CLASE, valor === "oscuro"),
    { immediate: true }
);

export function alternarTema() {
    tema.value = tema.value === "oscuro" ? "claro" : "oscuro";

    try {
        localStorage.setItem(CLAVE, tema.value);
    } catch {
        // Sin almacenamiento (modo privado): vale solo para esta sesión.
    }
}
