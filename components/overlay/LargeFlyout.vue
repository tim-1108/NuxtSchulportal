<script setup lang="ts">
import type { HorizontalOrigin, LargeFlyoutProperties, VerticalOrigin } from "~/composables/flyout";
import type { AnyFunction } from "~/common";

const FLYOUT_WIDTH = 300;

const props = defineProps<{ properties: LargeFlyoutProperties }>();
defineExpose({ getDimensions, inputPosition, inputTransform, requestClose, addCloseListener });

const el = useTemplateRef("element");
const uuid = useRandomUUID();

async function requestClose() {
    await closeFlyout();
}

const closeListeners = ref<AnyFunction[]>([]);
function addCloseListener(cb: AnyFunction) {
    closeListeners.value.push(cb);
}

async function closeFlyout() {
    isFlyoutClosing.value = true;
    await sleep(400);
    closeListeners.value.forEach((cb) => cb());
}

const isFlyoutDisabled = ref(true);
const isFlyoutClosing = ref(false);
const position = ref([0, 0]);

const transformOrigin = ref<[HorizontalOrigin, VerticalOrigin] | null>(null);

async function inputPosition([x, y]: number[]) {
    position.value = [x, y];
}
async function inputTransform(origin: [HorizontalOrigin, VerticalOrigin]) {
    transformOrigin.value = origin;
    await nextTick();
    isFlyoutDisabled.value = false;
    window.addEventListener("touchstart", closeFlyoutWithEvent, { passive: true });
}
function getDimensions() {
    if (el.value === null) return null;
    return el.value.getBoundingClientRect();
}

function closeFlyoutWithEvent(event: TouchEvent) {
    if (isFlyoutDisabled.value) return;
    if (!(event.target instanceof HTMLElement)) return;
    const isInsideFlyout = event.target.closest(`.large-flyout[data-uuid="${uuid}"]`);
    if (isInsideFlyout) return;
    closeFlyout();
}
onBeforeUnmount(() => {
    window.removeEventListener("touchstart", closeFlyoutWithEvent);
});
</script>

<template>
    <div
        class="flyout large-flyout"
        :style="{
            width: `${FLYOUT_WIDTH}px`,
            left: position[0] + 'px',
            top: position[1] + 'px',
            '--horizontal': transformOrigin ? transformOrigin[0] : '',
            '--vertical': transformOrigin ? transformOrigin[1] : ''
        }"
        :data-uuid="uuid"
        :data-open="isFlyoutDisabled ? null : true"
        :data-closing="isFlyoutClosing ? true : null"
        :class="{
            'opacity-0 pointer-events-none': isFlyoutDisabled
        }"
        ref="element">
        <component :is="props.properties.content"></component>
    </div>
</template>

<style scoped></style>
