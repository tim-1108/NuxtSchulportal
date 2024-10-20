<template>
    <div
        class="min-w-0 whitespace-nowrap overflow-hidden"
        ref="element"
        :style="{
            '--margin': MARGIN + 'px',
            '--text-length': textLength + 'px',
            '--duration': duration + 'ms'
        }"
        :data-animated="isMoving">
        <div class="min-w-0 flex">
            <slot />
            <template v-if="isMoving">
                <div style="min-width: var(--margin)"></div>
                <slot />
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
const PIXELS_PER_SECOND = 20;
const MARGIN = 40;
const props = defineProps<{ startDelay?: number; pixelsPerSecond?: number }>();

const textLength = ref(0);
const duration = ref(0);

const isUnmounted = ref(false);
const isMoving = ref(false);
const el = useTemplateRef<HTMLElement>("element");
onMounted(async () => {
    // Instead of using the CSS animation-delay property, we wait here.
    // If the property was set, the fade at both sides would already
    // be existent even before the animation started...
    await sleep(props.startDelay ?? 0);

    if (isUnmounted.value) return;

    if (el.value === null) {
        console.warn("[ScrollingText] Failed to initialize");
        return;
    }

    const { offsetWidth, scrollWidth } = el.value;
    if (offsetWidth >= scrollWidth) return;

    const pps = props.pixelsPerSecond ?? PIXELS_PER_SECOND;

    // Note that this only describes the length of ONE of the slots
    textLength.value = scrollWidth;
    duration.value = Math.floor((scrollWidth + MARGIN) / pps) * 1000;
    isMoving.value = true;
});

onBeforeUnmount(() => {
    isUnmounted.value = true;
});
</script>

<style scoped>
[data-animated="true"] {
    mask-image: var(--horizontal-fade-mask);
    mask-type: alpha;
    > div {
        animation: panning infinite var(--duration) linear;
    }
}
@keyframes panning {
    0% {
        transform: translateX(0);
    }
    /** This causes a snap-back in less than a frame, not visible for the user */
    99.999% {
        transform: translateX(calc(-1 * (var(--text-length) + var(--margin))));
    }
    100% {
        transform: translateX(0);
    }
}
</style>
