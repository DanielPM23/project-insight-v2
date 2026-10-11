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
                            "Indicadores de Demanda Táctica, Listado y ClearQuest"
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
                            "Vista consolidada de Demanda Táctica, ClearQuest y Listado",

                        // La tabla ocupa el alto disponible y hace scroll por dentro.
                        pantallaCompleta:
                            true
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
                            "Carga un Excel: se detecta su fuente y se compara con la última carga",

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
                            "Fin Desarrollo de Demanda Táctica vencido, que vence hoy o está por vencer"
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
                            "Qué cambió en cada carga y la historia de cada requerimiento"
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
                            "Administradores cargan datos y dan acceso; consulta solo visualiza",

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