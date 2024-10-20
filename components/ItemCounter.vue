<template>
    <div
        class="item-counter w-screen justify-center overflow-x-hidden flex"
        @touchstart.passive="startHighlight"
        @touchmove.passive="findHighlightedCounter"
        @touchend.passive="cancelHighlighting">
        <div class="item-counter-item" v-for="(_, index) of items" ref="items">
            <div
                class="bg-gray-500 rounded-full w-2 h-2 mx-1 my-4"
                :class="{
                    'bg-white': currentIndex === index,
                    hovered: index === hoveredIndex,
                    'hovered-1': index - 1 === hoveredIndex || index + 1 === hoveredIndex,
                    'hovered-2': index - 2 === hoveredIndex || index + 2 === hoveredIndex
                }"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
const emit = defineEmits(["move"]);
const elements = useTemplateRef<HTMLDivElement[]>("items");
interface Item {
    title: string;
    subtitle?: string;
}
const props = defineProps<{ items: Item[]; index: number }>();
const currentIndex = ref(0);

const hoveredIndex = ref<number | null>(null);

watch(props, (value) => {
    currentIndex.value = value.index;
});
const positions = ref<number[][]>([]);
onMounted(async () => {
    await useWait(100);
    window.addEventListener("resize", handleResize);
    handleResize();
});
onUnmounted(() => {
    window.removeEventListener("resize", handleResize);
});
function handleResize() {
    if (!elements.value) return;
    positions.value = elements.value.map((item) => {
        const { left, width } = item.getBoundingClientRect();
        return [left, left + width];
    });
}
const isSelecting = ref(false);
function startHighlight(event: TouchEvent) {
    isSelecting.value = true;
    findHighlightedCounter(event);
}
function findHighlightedCounter(event: TouchEvent) {
    if (!(event.target instanceof Element)) return cancelHighlighting();
    const container = event.target.closest<HTMLElement>(".item-counter");
    if (container === null) return cancelHighlighting();
    const position = event.touches[0].clientX;
    const proposedIndex = positions.value.findIndex((item) => item[0] <= position && item[1] > position);
    const isOverTop = (positions.value.at(-1)?.at(1) ?? 0) < event.touches[0].clientX;
    const index = clampNumber(isOverTop ? props.items.length - 1 : proposedIndex, 0, props.items.length - 1);
    hoveredIndex.value = index;
    emit("move", index);
}

function cancelHighlighting() {
    isSelecting.value = false;
    hoveredIndex.value = null;
}
</script>

<style scoped>
.item-counter-item {
    div {
        transition: scale 300ms;
    }
    > div.hovered {
        scale: 180%;
    }
    > div.hovered-1 {
        scale: 140%;
    }
    > div.hovered-2 {
        scale: 120%;
    }
}
</style>
