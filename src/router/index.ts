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
import ConfiguracionView from "../views/ConfiguracionView.vue";

const router = createRouter({
    history:
        createWebHistory(),
    routes: [

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
                            "Carga y análisis de fuentes de datos"
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
                        "auditoria",
                    name:
                        "auditoria",

                    component:
                    AuditoriaView,
                    meta: {
                        titulo:
                            "Auditoría",
                        subtitulo:
                            "Consistencia y comparación entre fuentes"
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
                            "Administración de Project Insight"
                    }
                }
            ]
        }

    ]

});


export default router;