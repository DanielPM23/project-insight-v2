import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";


export const firebaseConfig = {
    apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY,

    authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,

    projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID,

    storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,

    messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,

    appId:
    import.meta.env.VITE_FIREBASE_APP_ID,

    measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


const app = initializeApp(
    firebaseConfig
);


console.log(
    "🔥 Project ID:",
    app.options.projectId
);

console.log(
    "🔥 Auth Domain:",
    app.options.authDomain
);

console.log(
    "🔥 App ID:",
    app.options.appId
);


// Firebase Authentication
export const auth = getAuth(
    app
);


// Firestore
export const db = getFirestore(
    app
);


/*
 * Para probar sin tocar los datos reales:
 * VITE_FIREBASE_EMULADORES=true y `firebase emulators:start`.
 */
export const usaEmuladores =
    import.meta.env.VITE_FIREBASE_EMULADORES === "true";

if (usaEmuladores) {
    connectAuthEmulator(
        auth,
        "http://127.0.0.1:9099",
        { disableWarnings: true }
    );

    connectFirestoreEmulator(
        db,
        "127.0.0.1",
        8080
    );
}


export default app;