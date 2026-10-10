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
    from "@primeuix/themes/aura";
import {
    definePreset
} from "@primeuix/themes";
import Tooltip
    from "primevue/tooltip";
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

/*
 * Aura con el azul de Project Insight como color
 * principal.
 */
const ProjectInsightPreset =
    definePreset(Aura, {
        semantic: {
            primary: {
                50: "{blue.50}",
                100: "{blue.100}",
                200: "{blue.200}",
                300: "{blue.300}",
                400: "{blue.400}",
                500: "{blue.500}",
                600: "{blue.600}",
                700: "{blue.700}",
                800: "{blue.800}",
                900: "{blue.900}",
                950: "{blue.950}"
            }
        }
    });

app.use(
    PrimeVue,
    {
        /*
         * Licencia de PrimeUI (VITE_PRIMEUI_LICENSE en
         * .env.local, nunca en el repositorio).
         */
        license:
            import.meta.env.VITE_PRIMEUI_LICENSE || null,

        theme: {
            preset:
            ProjectInsightPreset,

            options: {
                darkModeSelector: false
            }
        }
    }
);
app.directive(
    "tooltip",
    Tooltip
);

app.mount(
    "#app"
);