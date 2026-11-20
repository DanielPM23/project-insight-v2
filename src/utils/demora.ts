import { onScopeDispose, ref, watch } from "vue";
import type { Ref } from "vue";


/*
 * Copia de un texto que se actualiza cuando el usuario deja
 * de escribir. Las búsquedas filtran con esta copia: así no
 * se vuelve a filtrar y pintar la tabla (o el calendario)
 * en cada tecla. Al vaciar el campo se aplica al instante.
 * Se puede asignar directamente para aplicar un valor sin
 * esperar (por ejemplo, el que llega en la URL).
 */
export function useTextoConDemora(
    origen: Ref<string>,
    milisegundos = 250
): Ref<string> {
    const valor = ref(origen.value);

    let temporizador: ReturnType<typeof setTimeout> | undefined;

    watch(origen, nuevo => {
        clearTimeout(temporizador);

        if (!nuevo.trim()) {
            valor.value = nuevo;
            return;
        }

        temporizador = setTimeout(() => {
            valor.value = nuevo;
        }, milisegundos);
    });

    onScopeDispose(() => clearTimeout(temporizador));

    return valor;
}
