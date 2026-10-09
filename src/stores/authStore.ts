import { defineStore } from "pinia";
import { computed, ref } from "vue";

import {
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut
} from "firebase/auth";

import type { User } from "firebase/auth";

import { auth } from "../firebase/firebase";

import {
    configurarAdminInicial,
    iamInicializado,
    obtenerPerfil
} from "../services/usuariosService";

import type { PerfilUsuario } from "../services/usuariosService";

import { useRequerimientosStore } from "./requerimientosStore";


/*
 * Sesión de Firebase Auth más el perfil con rol
 * guardado en usuarios/{uid}.
 */
export const useAuthStore = defineStore("auth", () => {
    const usuario = ref<User | null>(null);
    const perfil = ref<PerfilUsuario | null>(null);

    /*
     * Sin perfil todavía nadie es administrador: el
     * usuario que entra puede configurarse como tal.
     */
    const puedeSerAdminInicial = ref(false);

    const errorPerfil = ref("");

    let listo: Promise<void> | null = null;


    const autenticado = computed(
        () => usuario.value !== null
    );

    const tieneAcceso = computed(
        () => perfil.value?.activo === true
    );

    const esAdmin = computed(
        () => tieneAcceso.value && perfil.value?.rol === "admin"
    );


    async function cargarPerfil() {
        perfil.value = null;
        puedeSerAdminInicial.value = false;
        errorPerfil.value = "";

        if (!usuario.value) {
            return;
        }

        try {
            perfil.value =
                await obtenerPerfil(usuario.value.uid);

            if (!perfil.value) {
                puedeSerAdminInicial.value =
                    !(await iamInicializado());
            }
        } catch (e) {
            console.error("Error leyendo el perfil:", e);

            errorPerfil.value =
                "No se pudo leer tu perfil de usuario.";
        }
    }


    /*
     * Resuelve cuando Firebase ya sabe si hay sesión,
     * para que el router no decida antes de tiempo.
     */
    function iniciar(): Promise<void> {
        if (!listo) {
            listo = new Promise(resolve => {
                onAuthStateChanged(auth, async nuevo => {
                    const cambio =
                        nuevo?.uid !== usuario.value?.uid;

                    usuario.value = nuevo;

                    if (cambio) {
                        useRequerimientosStore().limpiar();
                    }

                    await cargarPerfil();

                    resolve();
                });
            });
        }

        return listo;
    }


    async function iniciarSesion(
        email: string,
        password: string
    ) {
        const credencial =
            await signInWithEmailAndPassword(
                auth,
                email.trim(),
                password
            );

        usuario.value = credencial.user;

        await cargarPerfil();
    }


    async function cerrarSesion() {
        await signOut(auth);

        usuario.value = null;
        perfil.value = null;
        puedeSerAdminInicial.value = false;

        useRequerimientosStore().limpiar();
    }


    async function restablecerPassword(
        email: string
    ) {
        await sendPasswordResetEmail(
            auth,
            email.trim()
        );
    }


    async function convertirseEnAdminInicial() {
        if (!usuario.value) {
            return;
        }

        await configurarAdminInicial(usuario.value);

        await cargarPerfil();
    }


    return {
        usuario,
        perfil,
        puedeSerAdminInicial,
        errorPerfil,
        autenticado,
        tieneAcceso,
        esAdmin,
        iniciar,
        iniciarSesion,
        cerrarSesion,
        restablecerPassword,
        convertirseEnAdminInicial,
        cargarPerfil
    };
});
