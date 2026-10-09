import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import {
    createApp
} from "vue";
import {
    createPinia
} from "pinia";
import PrimeVue
    from "primevue/config";

import Aura
    from "@primevue/themes/aura";
import App
    from "./App.vue";
import router
    from "./router";

import "primeicons/primeicons.css";
import "./style.css";

const app =
    createApp(App);
app.use(
    createPinia()
);

app.use(
    router
);

app.use(
    PrimeVue,
    {
        theme: {
            preset:
            Aura
        }
    }
);
app.mount(
    "#app"
);