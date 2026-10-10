# Project Insight

App web (Vue 3 + Vite + Firebase) que cruza los Excels de Demanda Táctica,
ClearQuest y Listado por ID de mantenimiento.

## Desarrollo

```
npm install
npm run dev
```

La configuración de Firebase va en `.env.local` (no se sube al repo) con las
variables `VITE_FIREBASE_*`. La licencia de PrimeUI va en el mismo archivo como
`VITE_PRIMEUI_LICENSE`; sin ella PrimeVue muestra un aviso de licencia.

## Accesos

Hay dos roles, guardados en la colección `usuarios` de Firestore:

- **Administrador**: carga los Excels (Importaciones) y crea usuarios.
- **Consulta**: ve Dashboard, Requerimientos y el detalle, sin modificar nada.

`firestore.rules` hace cumplir estos permisos: sin sesión o sin perfil activo
no se lee ningún dato.

### Primera puesta en marcha

1. En Firebase Console, **Authentication → Sign-in method**, habilita
   **Correo electrónico/contraseña**.
2. En **Authentication → Users**, agrega tu cuenta.
3. Publica las reglas: `firebase deploy --only firestore:rules`.
4. Entra a la app con esa cuenta y pulsa **Quedar como administrador**.
   Solo el primer usuario puede hacerlo.
5. Desde **Usuarios** crea las cuentas de los demás con su rol.

## Despliegue (Firebase Hosting)

```
npm install -g firebase-tools
firebase login
firebase use --add
npm run build
firebase deploy --only hosting,firestore:rules
```

## Probar con emuladores

Para no tocar los datos reales:

```
firebase emulators:start --only auth,firestore --project demo-pi
VITE_FIREBASE_EMULADORES=true VITE_FIREBASE_PROJECT_ID=demo-pi npm run dev
```
