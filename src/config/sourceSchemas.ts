export type FuenteDatos =
    | "DEMANDA_TACTICA"
    | "CLEARQUEST"
    | "DESCONOCIDA";


export interface ConfiguracionCampo {
    obligatorio: boolean;
    aliases: string[];
}


export interface ConfiguracionFuente {
    nombre: string;

    campos: Record<
        string,
        ConfiguracionCampo
    >;
}


// =========================================================
// DEMANDA TÁCTICA
// =========================================================

const DEMANDA_TACTICA: ConfiguracionFuente = {

    nombre:
        "Demanda Táctica",

    campos: {

        id_demanda: {
            obligatorio: true,
            aliases: [
                "ID Demanda",
                "ID de Demanda"
            ]
        },

        id_tramite: {
            obligatorio: false,
            aliases: [
                "ID Trámite",
                "ID Tramite"
            ]
        },

        id_mantenimiento: {
            obligatorio: false,
            aliases: [
                "ID Mantenimiento",
                "Mantenimiento"
            ]
        },

        nombre_requerimiento: {
            obligatorio: true,
            aliases: [
                "Nombre del requerimiento",
                "Nombre del Requerimiento"
            ]
        },

        estado_ti: {
            obligatorio: true,
            aliases: [
                "Estado TI"
            ]
        },

        gerencia: {
            obligatorio: false,
            aliases: [
                "Gerencia"
            ]
        },

        seccion_ti: {
            obligatorio: false,
            aliases: [
                "Seccion TI",
                "Sección TI",
                "Área Responsable TI"
            ]
        },

        responsable_dt: {
            obligatorio: false,
            aliases: [
                "Responsable de atención",
                "Responsable de atencion",
                "Líder Técnico/Analista",
                "Lider Tecnico/Analista"
            ]
        },

        gestor: {
            obligatorio: false,
            aliases: [
                "Gestor",
                "Gestor TI"
            ]
        },

        recurso: {
            obligatorio: false,
            aliases: [
                "Recurso",
                "Tipo de recurso",
                "Origen de desarrollo"
            ]
        },

        prioridad: {
            obligatorio: false,
            aliases: [
                "Prioridad"
            ]
        },

        orden_atencion: {
            obligatorio: false,
            aliases: [
                "Orden de Atención",
                "Orden de Atencion"
            ]
        },

        porcentaje_avance: {
            obligatorio: false,
            aliases: [
                "Porcentaje de Avance"
            ]
        },

        indicador_avance: {
            obligatorio: false,
            aliases: [
                "Indicador de Avance"
            ]
        },

        comienzo_desarrollo: {
            obligatorio: false,
            aliases: [
                "Comienzo Desarrollo"
            ]
        },

        fin_desarrollo: {
            obligatorio: false,
            aliases: [
                "Fin Desarrollo"
            ]
        },

        comienzo_desarrollo_real: {
            obligatorio: false,
            aliases: [
                "Comienzo Desarrollo Real"
            ]
        },

        fin_desarrollo_real: {
            obligatorio: false,
            aliases: [
                "Fin Desarrollo Real"
            ]
        },

        estado_cq_dt: {
            obligatorio: false,
            aliases: [
                "Estado CQ",
                "Último Estado ClearQuest"
            ]
        },

        ultima_actividad_cq: {
            obligatorio: false,
            aliases: [
                "Última Actividad CQ",
                "Última Actividad"
            ]
        },

        fecha_ultimo_estado_cq: {
            obligatorio: false,
            aliases: [
                "Fecha de Último Estado CQ",
                "Fecha de último Estado"
            ]
        }

    }

};


// =========================================================
// CLEARQUEST
// =========================================================

const CLEARQUEST: ConfiguracionFuente = {

    nombre:
        "ClearQuest",

    campos: {

        id_mantenimiento: {
            obligatorio: true,
            aliases: [
                "Mantto. ID",
                "Mantto ID",
                "ID Mantenimiento",
                "Mantenimiento"
            ]
        },

        aplicacion_cq: {
            obligatorio: false,
            aliases: [
                "APLIC",
                "Aplicación",
                "Aplicacion"
            ]
        },

        descripcion_cq: {
            obligatorio: true,
            aliases: [
                "DESCRIPCION",
                "DESCRIPCIÓN",
                "Descripción"
            ]
        },

        area_solicitante_cq: {
            obligatorio: false,
            aliases: [
                "AREA SOLICITANTE",
                "ÁREA SOLICITANTE"
            ]
        },

        fecha_registro_cq: {
            obligatorio: false,
            aliases: [
                "F.REGISTRO",
                "F. REGISTRO"
            ]
        },

        jefe_seccion_cq: {
            obligatorio: false,
            aliases: [
                "J.SECCIÓN",
                "J.SECCION",
                "J. SECCIÓN"
            ]
        },

        fecha_inicio_plan_cq: {
            obligatorio: false,
            aliases: [
                "F.INICIO PLAN",
                "F. INICIO PLAN"
            ]
        },

        fecha_final_plan_cq: {
            obligatorio: false,
            aliases: [
                "F.FINAL PLAN",
                "F. FINAL PLAN"
            ]
        },

        fecha_asignacion_cq: {
            obligatorio: false,
            aliases: [
                "F.ASIGNACIÓN",
                "F.ASIGNACION",
                "F. ASIGNACIÓN"
            ]
        },

        analista_cq: {
            obligatorio: false,
            aliases: [
                "ANALISTA"
            ]
        },

        fecha_finaliza_cq: {
            obligatorio: false,
            aliases: [
                "F.FINALIZA AD",
                "F. FINALIZA AD"
            ]
        },

        estado_cq: {
            obligatorio: true,
            aliases: [
                "ESTADO"
            ]
        }

    }

};


// =========================================================
// CATÁLOGO
// =========================================================

export const FUENTES: Record<
    Exclude<
        FuenteDatos,
        "DESCONOCIDA"
    >,
    ConfiguracionFuente
> = {

    DEMANDA_TACTICA,

    CLEARQUEST

};