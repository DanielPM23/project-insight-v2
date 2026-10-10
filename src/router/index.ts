import {
    createRouter,
    createWebHistory
} from "vue-router";

import MainLayout from "../layouts/MainLayout.vue";

import DashboardView from "../views/DashboardView.vue";
import RequerimientosView from "../views/RequerimientosView.vue";
import RequerimientoDetalleView from "../views/RequerimientoDetalleView.vue";
import ImportacionesView from "../views/ImportacionesView.vue";
import PlanificacionView from "../views/PlanificacionView.vue";
import ReportesView from "../views/ReportesView.vue";
import AuditoriaView from "../views/AuditoriaView.vue";
import AlertasView from "../views/AlertasView.vue";
import ConfiguracionView from "../views/ConfiguracionView.vue";
import UsuariosView from "../views/UsuariosView.vue";
import LoginView from "../views/LoginView.vue";

import { useAuthStore } from "../stores/authStore";

const router = createRouter({
    history:
        createWebHistory(),
    routes: [

        {
            path: "/login",
            name: "login",
            component:
            LoginView,
            meta: {
                publica: true
            }
        },

        {
            path: "/",

            component:
            MainLayout,

            redirect:
                "/dashboard",
            children: [
                {
                    path:
                        "dashboard",
                    name:
                        "dashboard",
                    component:
                    DashboardView,
                    meta: {
                        titulo:
                            "Dashboard",

                        subtitulo:
                            "Vista general de Project Insight"
                    }
                },

                {
                    path:
                        "requerimientos",
                    name:
                        "requerimientos",

                    component:
                    RequerimientosView,

                    meta: {
                        titulo:
                            "Requerimientos",
                        subtitulo:
                            "Consulta y gestión de requerimientos"
                    }
                },

                {
                    path:
                        "requerimientos/:id",
                    name:
                        "requerimiento-detalle",

                    component:
                    RequerimientoDetalleView,

                    props:
                        true,

                    meta: {
                        titulo:
                            "Detalle del requerimiento",
                        subtitulo:
                            "Todos los campos de Demanda Táctica, Listado y ClearQuest"
                    }
                },

                {
                    path:
                        "importaciones",
                    name:
                        "importaciones",
                    component:
                    ImportacionesView,
                    meta: {
                        titulo:
                            "Importaciones",

                        subtitulo:
                            "Carga y análisis de fuentes de datos",

                        soloAdmin:
                            true
                    }
                },

                {
                    path:
                        "planificacion",

                    name:
                        "planificacion",

                    component:
                    PlanificacionView,
                    meta: {
                        titulo:
                            "Planificación",

                        subtitulo:
                            "Cronogramas y seguimiento"
                    }
                },

                {
                    path:
                        "reportes",
                    name:
                        "reportes",
                    component:
                    ReportesView,
                    meta: {
                        titulo:
                            "Reportes",
                        subtitulo:
                            "Análisis e indicadores de gestión"
                    }
                },

                {
                    path:
                        "alertas",
                    name:
                        "alertas",
                    component:
                    AlertasView,
                    meta: {
                        titulo:
                            "Alertas",
                        subtitulo:
                            "Seguimiento de fechas de fin de desarrollo"
                    }
                },

                {
                    path:
                        "auditoria",
                    name:
                        "auditoria",

                    component:
                    AuditoriaView,
                    meta: {
                        titulo:
                            "Auditoría",
                        subtitulo:
                            "Historial de cargas y cambios por requerimiento"
                    }
                },

                {
                    path:
                        "configuracion",
                    name:
                        "configuracion",
                    component:
                    ConfiguracionView,
                    meta: {
                        titulo:
                            "Configuración",

                        subtitulo:
                            "Administración de Project Insight",

                        soloAdmin:
                            true
                    }
                },

                {
                    path:
                        "usuarios",
                    name:
                        "usuarios",
                    component:
                    UsuariosView,
                    meta: {
                        titulo:
                            "Usuarios",

                        subtitulo:
                            "Accesos y roles",

                        soloAdmin:
                            true
                    }
                }
            ]
        }

    ]

});


/*
 * Sin sesión o sin perfil activo se va al login; las
 * rutas de carga y administración son solo para admin.
 * Las reglas de Firestore repiten estos permisos.
 */
router.beforeEach(async to => {
    const auth = useAuthStore();

    await auth.iniciar();

    if (to.meta.publica) {
        return true;
    }

    if (!auth.tieneAcceso) {
        return {
            name: "login",
            query: to.fullPath !== "/" ? { redirect: to.fullPath } : {}
        };
    }

    if (to.meta.soloAdmin && !auth.esAdmin) {
        return { name: "dashboard" };
    }

    return true;
});


export default router;