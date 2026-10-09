import {
    deleteApp,
    initializeApp
} from "firebase/app";

import {
    connectAuthEmulator,
    createUserWithEmailAndPassword,
    getAuth,
    signOut
} from "firebase/auth";

import type {
    User
} from "firebase/auth";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch
} from "firebase/firestore";

import {
    db,
    firebaseConfig,
    usaEmuladores
} from "../firebase/firebase";


/*
 * Permisos de Project Insight.
 *
 * - admin: carga los Excels (Importaciones) y
 *   administra usuarios.
 * - consulta: ve Dashboard, Requerimientos y el
 *   detalle, sin poder modificar datos.
 *
 * El rol vive en usuarios/{uid}; las reglas de
 * Firestore (firestore.rules) lo hacen cumplir.
 */
export type Rol =
    "admin" |
    "consulta";


export const ROLES: {
    valor: Rol;
    nombre: string;
    descripcion: string;
}[] = [
    {
        valor: "admin",
        nombre: "Administrador",
        descripcion: "Carga datos y administra usuarios"
    },
    {
        valor: "consulta",
        nombre: "Consulta",
        descripcion: "Solo puede ver la información"
    }
];


export interface PerfilUsuario {
    uid: string;
    email: string;
    nombre: string;
    rol: Rol;
    activo: boolean;
}


export const COLECCION_USUARIOS =
    "usuarios";

/*
 * Marca que ya existe el administrador inicial.
 * Mientras no exista, el primer usuario que entra
 * puede configurarse como administrador.
 */
const DOCUMENTO_IAM =
    doc(db, "sistema", "iam");


function leerPerfil(
    uid: string,
    datos: Record<string, unknown>
): PerfilUsuario {
    return {
        uid,
        email: String(datos.email ?? ""),
        nombre: String(datos.nombre ?? ""),
        rol: datos.rol === "admin" ? "admin" : "consulta",
        activo: datos.activo === true
    };
}


export async function obtenerPerfil(
    uid: string
): Promise<PerfilUsuario | null> {
    const snapshot =
        await getDoc(
            doc(db, COLECCION_USUARIOS, uid)
        );

    return snapshot.exists()
        ? leerPerfil(uid, snapshot.data())
        : null;
}


export async function iamInicializado(): Promise<boolean> {
    const snapshot =
        await getDoc(DOCUMENTO_IAM);

    return snapshot.exists();
}


/*
 * Solo funciona una vez: las reglas rechazan crear
 * sistema/iam si ya existe.
 */
export async function configurarAdminInicial(
    usuario: User
): Promise<void> {
    const batch =
        writeBatch(db);

    batch.set(
        doc(db, COLECCION_USUARIOS, usuario.uid),
        {
            email: usuario.email ?? "",
            nombre: usuario.displayName ?? usuario.email ?? "",
            rol: "admin",
            activo: true,
            fechaCreacion: serverTimestamp(),
            fechaActualizacion: serverTimestamp()
        }
    );

    batch.set(
        DOCUMENTO_IAM,
        {
            adminInicial: usuario.uid,
            fechaCreacion: serverTimestamp()
        }
    );

    await batch.commit();
}


export async function listarUsuarios(): Promise<PerfilUsuario[]> {
    const snapshot =
        await getDocs(
            collection(db, COLECCION_USUARIOS)
        );

    return snapshot.docs
        .map(item => leerPerfil(item.id, item.data()))
        .sort((a, b) =>
            (a.nombre || a.email).localeCompare(
                b.nombre || b.email,
                "es"
            )
        );
}


/*
 * Crear la cuenta con la instancia principal de Auth
 * cerraría la sesión del administrador, así que se usa
 * una instancia aparte solo para crearla.
 */
export async function crearUsuario(
    datos: {
        email: string;
        password: string;
        nombre: string;
        rol: Rol;
    },
    creadoPor: string
): Promise<PerfilUsuario> {
    const appSecundaria =
        initializeApp(
            firebaseConfig,
            `creacion-usuario-${Date.now()}`
        );

    try {
        const authSecundaria =
            getAuth(appSecundaria);

        if (usaEmuladores) {
            connectAuthEmulator(
                authSecundaria,
                "http://127.0.0.1:9099",
                { disableWarnings: true }
            );
        }

        const credencial =
            await createUserWithEmailAndPassword(
                authSecundaria,
                datos.email.trim(),
                datos.password
            );

        await signOut(authSecundaria);

        const perfil: PerfilUsuario = {
            uid: credencial.user.uid,
            email: datos.email.trim(),
            nombre: datos.nombre.trim(),
            rol: datos.rol,
            activo: true
        };

        await setDoc(
            doc(db, COLECCION_USUARIOS, perfil.uid),
            {
                email: perfil.email,
                nombre: perfil.nombre,
                rol: perfil.rol,
                activo: perfil.activo,
                creadoPor,
                fechaCreacion: serverTimestamp(),
                fechaActualizacion: serverTimestamp()
            }
        );

        return perfil;
    } finally {
        await deleteApp(appSecundaria);
    }
}


export async function actualizarUsuario(
    uid: string,
    cambios: Partial<Pick<PerfilUsuario, "nombre" | "rol" | "activo">>
): Promise<void> {
    await updateDoc(
        doc(db, COLECCION_USUARIOS, uid),
        {
            ...cambios,
            fechaActualizacion: serverTimestamp()
        }
    );
}


/*
 * Mensajes de Firebase Auth en español.
 */
export function mensajeErrorAuth(
    error: unknown
): string {
    const codigo =
        typeof error === "object" && error && "code" in error
            ? String((error as { code: unknown }).code)
            : "";

    const mensajes: Record<string, string> = {
        "auth/invalid-credential": "Correo o contraseña incorrectos.",
        "auth/invalid-email": "El correo no es válido.",
        "auth/user-disabled": "Esta cuenta está deshabilitada.",
        "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
        "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/operation-not-allowed": "El acceso con correo y contraseña no está habilitado en Firebase.",
        "auth/network-request-failed": "No hay conexión con Firebase.",
        "permission-denied": "No tienes permiso para esta acción."
    };

    if (mensajes[codigo]) {
        return mensajes[codigo];
    }

    return error instanceof Error
        ? error.message
        : "Ocurrió un error inesperado.";
}
