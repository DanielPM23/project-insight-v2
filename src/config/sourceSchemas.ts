export type FuenteDatos =
    | "DEMANDA_TACTICA"
    | "CLEARQUEST"
    | "LISTADO"
    | "DESCONOCIDA";


export type FuenteConocida =
    Exclude<
        FuenteDatos,
        "DESCONOCIDA"
    >;


/*
 * Código corto que se usa en IDs de documento,
 * insignias y filtros de la interfaz.
 */
export type CodigoFuente =
    | "DT"
    | "CQ"
    | "LS";


export type TipoCampo =
    | "texto"
    | "fecha";


export interface ConfiguracionCampo {
    obligatorio: boolean;
    aliases: string[];
    tipo?: TipoCampo;
}


export interface ColumnaVista {
    campo: string;
    titulo: string;
}


export interface ConfiguracionFuente {
    nombre: string;

    codigo: CodigoFuente;

    /*
     * Campos que identifican una fila dentro de su propio
     * Excel. Se usa el primero que tenga valor.
     */
    camposClave: string[];

    nombreClave: string;

    /*
     * Campos con el ID de mantenimiento / proyecto y
     * de trámite. Se normalizan para hacer el matching
     * entre fuentes.
     */
    campoMantenimiento: string;

    campoTramite: string | null;

    campoNombre: string;

    campoEstado: string;

    /*
     * Si el libro tiene varias hojas con las mismas
     * cabeceras, se prefiere la hoja con este nombre.
     */
    hojasPreferidas: string[];

    columnasVista: ColumnaVista[];

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

    codigo:
        "DT",

    camposClave: [
        "id_historico",
        "id_demanda"
    ],

    nombreClave:
        "ID Histórico / ID Demanda",

    campoMantenimiento:
        "id_mantenimiento",

    campoTramite:
        "id_tramite",

    campoNombre:
        "nombre_requerimiento",

    campoEstado:
        "estado_ti",

    hojasPreferidas: [
        "DEMANDA TÁCTICA"
    ],

    columnasVista: [
        { campo: "id_demanda", titulo: "ID Demanda" },
        { campo: "id_mantenimiento", titulo: "ID Mantenimiento" },
        { campo: "id_tramite", titulo: "ID Trámite" },
        { campo: "nombre_requerimiento", titulo: "Requerimiento" },
        { campo: "estado_ti", titulo: "Estado TI" },
        { campo: "responsable_dt", titulo: "Responsable" }
    ],

    campos: {

        id_historico: {
            obligatorio: false,
            aliases: [
                "ID Histórico",
                "ID Historico"
            ]
        },

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

/*
 * Cada fila es una actividad (2024-M0243-A001).
 * El mantenimiento se obtiene quitando el sufijo -A###.
 *
 * Se mantienen los aliases del formato anterior
 * (Mantto. ID, DESCRIPCION, ANALISTA...) además del
 * export actual (Actividad_ID, Resumen, Responsable...).
 */
const CLEARQUEST: ConfiguracionFuente = {

    nombre:
        "ClearQuest",

    codigo:
        "CQ",

    camposClave: [
        "id_cq",
        "id_mantenimiento"
    ],

    nombreClave:
        "id (ClearQuest)",

    campoMantenimiento:
        "id_mantenimiento",

    campoTramite:
        null,

    campoNombre:
        "descripcion_cq",

    campoEstado:
        "estado_cq",

    hojasPreferidas: [],

    columnasVista: [
        { campo: "id_mantenimiento", titulo: "Actividad" },
        { campo: "id_cq", titulo: "id CQ" },
        { campo: "descripcion_cq", titulo: "Resumen" },
        { campo: "aplicacion_cq", titulo: "Proyecto" },
        { campo: "analista_cq", titulo: "Responsable" },
        { campo: "estado_cq", titulo: "Estado" }
    ],

    campos: {

        id_mantenimiento: {
            obligatorio: true,
            aliases: [
                "Actividad_ID",
                "Actividad ID",
                "Mantto. ID",
                "Mantto ID",
                "ID Mantenimiento",
                "Mantenimiento"
            ]
        },

        id_cq: {
            obligatorio: false,
            aliases: [
                "id"
            ]
        },

        aplicacion_cq: {
            obligatorio: false,
            aliases: [
                "Proyecto",
                "APLIC",
                "Aplicación",
                "Aplicacion"
            ]
        },

        descripcion_cq: {
            obligatorio: true,
            aliases: [
                "Resumen",
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
            tipo: "fecha",
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
            tipo: "fecha",
            aliases: [
                "F.Inicio Plan",
                "F. INICIO PLAN"
            ]
        },

        fecha_final_plan_cq: {
            obligatorio: false,
            tipo: "fecha",
            aliases: [
                "F.Final Plan",
                "F. FINAL PLAN"
            ]
        },

        fecha_inicio_ejec_cq: {
            obligatorio: false,
            tipo: "fecha",
            aliases: [
                "F.Inicio Ejec"
            ]
        },

        fecha_final_ejec_cq: {
            obligatorio: false,
            tipo: "fecha",
            aliases: [
                "F.Final Ejec"
            ]
        },

        duracion_plan_cq: {
            obligatorio: false,
            aliases: [
                "Duracion Plan",
                "Duración Plan"
            ]
        },

        duracion_ejec_cq: {
            obligatorio: false,
            aliases: [
                "Duracion Ejec",
                "Duración Ejec"
            ]
        },

        fecha_asignacion_cq: {
            obligatorio: false,
            tipo: "fecha",
            aliases: [
                "F.ASIGNACIÓN",
                "F.ASIGNACION",
                "F. ASIGNACIÓN"
            ]
        },

        analista_cq: {
            obligatorio: false,
            aliases: [
                "Responsable",
                "ANALISTA"
            ]
        },

        fecha_finaliza_cq: {
            obligatorio: false,
            tipo: "fecha",
            aliases: [
                "F.FINALIZA AD",
                "F. FINALIZA AD"
            ]
        },

        anio_cq: {
            obligatorio: false,
            aliases: [
                "Año",
                "Anio"
            ]
        },

        estado_cq: {
            obligatorio: true,
            aliases: [
                "Estado"
            ]
        }

    }

};


// =========================================================
// LISTADO
// =========================================================

const LISTADO: ConfiguracionFuente = {

    nombre:
        "Listado",

    codigo:
        "LS",

    camposClave: [
        "caso"
    ],

    nombreClave:
        "Caso",

    campoMantenimiento:
        "id_mantenimiento",

    campoTramite:
        "id_tramite",

    campoNombre:
        "asunto",

    campoEstado:
        "estado_ls",

    hojasPreferidas: [
        "Datos"
    ],

    columnasVista: [
        { campo: "caso", titulo: "Caso" },
        { campo: "id_mantenimiento", titulo: "ID Mantenimiento" },
        { campo: "id_tramite", titulo: "ID Trámite" },
        { campo: "asunto", titulo: "Asunto" },
        { campo: "estado_ls", titulo: "Estado" },
        { campo: "analista_bn", titulo: "Analista BN" }
    ],

    campos: {

        caso: {
            obligatorio: true,
            aliases: [
                "Caso"
            ]
        },

        id_mantenimiento: {
            obligatorio: false,
            aliases: [
                "Número de mantenimiento",
                "Numero de mantenimiento"
            ]
        },

        id_tramite: {
            obligatorio: false,
            aliases: [
                "Número de trámite",
                "Numero de tramite"
            ]
        },

        asunto: {
            obligatorio: true,
            aliases: [
                "Asunto"
            ]
        },

        aplicativo: {
            obligatorio: false,
            aliases: [
                "Aplicativo"
            ]
        },

        grupo_responsable: {
            obligatorio: false,
            aliases: [
                "Grupo responsable"
            ]
        },

        estado_ls: {
            obligatorio: true,
            aliases: [
                "Estado"
            ]
        },

        razon: {
            obligatorio: false,
            aliases: [
                "Razón",
                "Razon"
            ]
        },

        fase: {
            obligatorio: false,
            aliases: [
                "Fase"
            ]
        },

        servicio: {
            obligatorio: false,
            aliases: [
                "Servicio"
            ]
        },

        seccion: {
            obligatorio: false,
            aliases: [
                "Sección",
                "Seccion"
            ]
        },

        analista_bn: {
            obligatorio: false,
            aliases: [
                "Analista BN"
            ]
        },

        categoria: {
            obligatorio: false,
            aliases: [
                "Categoría",
                "Categoria"
            ]
        },

        gerencia_usuaria: {
            obligatorio: false,
            aliases: [
                "Gerencia Usuaria"
            ]
        },

        usuario_solicitante: {
            obligatorio: false,
            aliases: [
                "Usuario Solicitante"
            ]
        },

        fecha_registro: {
            obligatorio: false,
            tipo: "fecha",
            aliases: [
                "Fecha de registro"
            ]
        },

        orden_atencion: {
            obligatorio: false,
            aliases: [
                "Orden de Atención",
                "Orden de Atencion"
            ]
        },

        seguimiento: {
            obligatorio: false,
            aliases: [
                "Seguimiento"
            ]
        }

    }

};


// =========================================================
// CATÁLOGO
// =========================================================

export const FUENTES: Record<
    FuenteConocida,
    ConfiguracionFuente
> = {

    DEMANDA_TACTICA,

    CLEARQUEST,

    LISTADO

};


export const FUENTE_POR_CODIGO: Record<
    CodigoFuente,
    FuenteConocida
> = {

    DT: "DEMANDA_TACTICA",

    CQ: "CLEARQUEST",

    LS: "LISTADO"

};


export function esFuenteConocida(
    fuente: FuenteDatos
): fuente is FuenteConocida {
    return fuente !== "DESCONOCIDA";
}
