<template>
    <div
        class="flyout small-flyout"
        :style="{
            width: `${FLYOUT_WIDTH}px`,
            left: position[0] + 'px',
            top: position[1] + 'px',
            '--horizontal': transformOrigin ? transformOrigin[0] : '',
            '--vertical': transformOrigin ? transformOrigin[1] : ''
        }"
        @touchstart.passive="handleTouchInputs"
        @touchmove.passive="handleTouchInputs"
        @touchend.passive="submitTouchInput"
        :data-open="isFlyoutDisabled ? null : true"
        :data-closing="isFlyoutClosing ? true : null"
        :data-uuid="uuid"
        :class="{
            'opacity-0 pointer-events-none': isFlyoutDisabled
        }"
        ref="flyout">
        <section class="grid" v-for="(group, groupIndex) of properties.groups" v-if="hasAnyItems">
            <h2 class="text-center px-2 py-1" v-if="group.title">{{ group.title }}</h2>
            <div
                :data-group-index="groupIndex"
                :data-item-index="index"
                data-small-flyout-item=""
                :data-type="item.type ?? 'default'"
                :data-disabled="item.disabled ? true : null"
                :data-selected="
                    (hoveredGroupIndex === groupIndex && hoveredItemIndex === index) ||
                    (currentChainedFlyout && groupIndex === currentChainedFlyout.group && index === currentChainedFlyout.item)
                "
                class="item"
                v-for="(item, index) of group.items"
                ref="items">
                <div>
                    <p>
                        {{ item.title }}
                    </p>
                    <small v-if="item.text">{{ item.text }}</small>
                </div>
                <font-awesome-icon v-if="item.type !== 'expand' && item.icon" :icon="item.icon"></font-awesome-icon>
                <font-awesome-icon v-if="item.type === 'expand'" :icon="['fas', 'chevron-right']"></font-awesome-icon>
            </div>
        </section>
        <section class="px-4 py-2" v-if="!hasAnyItems">Keine Aktionen</section>
    </div>
</template>

<script setup lang="ts">
import type { HorizontalOrigin, RegisteredFlyoutMetadata, SmallFlyoutProperties, VerticalOrigin } from "~/composables/flyout";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import type { AnyFunction } from "~/common";

const FLYOUT_WIDTH = 190;

const props = defineProps<{ properties: SmallFlyoutProperties }>();
defineExpose({ getDimensions, inputPosition, inputTransform, requestClose, addCloseListener });

const el = useTemplateRef<HTMLElement>("flyout");

/**
 * Can be called from the parent flyout to request closure.
 */
async function requestClose() {
    await closeFlyout();
}

const closeListeners = ref<AnyFunction[]>([]);
function addCloseListener(cb: AnyFunction) {
    closeListeners.value.push(cb);
}

interface IndexedFlyoutMetadata extends RegisteredFlyoutMetadata {
    group: number;
    item: number;
}
const currentChainedFlyout = ref<IndexedFlyoutMetadata | null>(null);
/**
 * Prevents opening multiple children all at once.
 */
const isRegisteringChild = ref(false);
async function registerChainedFlyout(groups: FlyoutGroup[], group: number, item: number) {
    if (isRegisteringChild.value || !el.value) return;
    isRegisteringChild.value = true;

    // First, the old one has to go!
    if (currentChainedFlyout.value) {
        const { group: iGroup, item: iItem } = currentChainedFlyout.value;
        await currentChainedFlyout.value.requestClose();

        currentChainedFlyout.value = null;

        // If the user presses the same button again, they most
        // likely wish to close the chained flyout.
        if (iGroup === group && iItem === item) {
            isRegisteringChild.value = false;
            return;
        }
    }

    /**
     * Using the element of the item directly as the parent instead of the whole flyout
     * aligns the child closer to that item the user clicked.
     */
    const itemEl = el.value.querySelector(`.item[data-group-index="${group}"][data-item-index="${item}"]`);
    const metadata = await createChainedFlyout(groups, itemEl);
    if (metadata === null) {
        isRegisteringChild.value = false;
        return;
    }
    metadata.addCloseListener(() => (currentChainedFlyout.value = null));
    currentChainedFlyout.value = { ...metadata, group, item };
    isRegisteringChild.value = false;
}

/**
 * The flyout is disabled/hidden as long as createFlyout has not yet
 * passed a position value. It is hidden so the size can be computed
 * without the user seeing a misaligned flyout for a few frames.
 */
const isFlyoutDisabled = ref(true);
const isFlyoutClosing = ref(false);
const position = ref([0, 0]);

const hoveredGroupIndex = ref(-1);
const hoveredItemIndex = ref(-1);

function handleTouchInputs(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    const elFromPoint = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!(elFromPoint instanceof Element)) return;

    const el = elFromPoint.closest("[data-small-flyout-item]");
    if (el === null) {
        hoveredGroupIndex.value = -1;
        hoveredItemIndex.value = -1;
        return;
    }

    const indices = ["data-group-index", "data-item-index"].map((attr) => parseInt(el.getAttribute(attr)!));
    if (indices.some((index) => !Number.isSafeInteger(index) || index < 0)) return;
    const [group, item] = indices;
    hoveredGroupIndex.value = group;
    hoveredItemIndex.value = item;
}

async function submitTouchInput() {
    const iGroup = hoveredGroupIndex.value;
    const iItem = hoveredItemIndex.value;
    hoveredGroupIndex.value = -1;
    hoveredItemIndex.value = -1;
    if (iGroup === -1 && iItem === -1) return;
    const item = props.properties.groups[iGroup].items[iItem];
    if (item.type === "expand") {
        await registerChainedFlyout(item.chained_flyout, iGroup, iItem);
        return;
    }
    if ("action" in item && typeof item.action === "function" && !item.disabled) void item.action();
    await closeFlyout();
}
onUnmounted(() => {
    window.removeEventListener("touchstart", closeFlyoutWithEvent);
});

const uuid = useRandomUUID();
function closeFlyoutWithEvent(event: Event) {
    if (isFlyoutDisabled.value) return;
    if (!(event.target instanceof Element)) return;
    const isInsideFlyout = event.target.closest(`.small-flyout[data-uuid="${uuid}"]`);
    if (isInsideFlyout) return;
    closeFlyout();
}

async function closeFlyout() {
    isFlyoutClosing.value = true;
    if (currentChainedFlyout.value) void currentChainedFlyout.value.requestClose();
    await sleep(400);
    // Yes, this will call a callback on the parent, who just requested a close on this child.
    // (but also for the unmount handler)
    closeListeners.value.forEach((cb) => cb());
}

const transformOrigin = ref<[HorizontalOrigin, VerticalOrigin] | null>(null);

/**
 * This function is exposed to allow createFlyout to call this.
 */
async function inputPosition([x, y]: number[]) {
    position.value = [x, y];
}

/**
 * This promise will not resolve until the flyout is closed.
 * Then the render function will be called on the wrapper, clearing the component.
 */
async function inputTransform(origin: [HorizontalOrigin, VerticalOrigin]) {
    transformOrigin.value = origin;
    await nextTick();
    isFlyoutDisabled.value = false;
    window.addEventListener("touchstart", closeFlyoutWithEvent, { passive: true });
}

/**
 * This function is exposed for a call from createFlyout.
 */
function getDimensions() {
    if (el.value === null) return null;
    return el.value.getBoundingClientRect();
}

const hasAnyItems = computed(() => props.properties.groups.some((group) => group.items.length));
</script>

<style scoped>
.item:not(:first-child) {
    @apply border-t-2 border-solid;
    border-color: var(--flyout-border);
}

section:not(:first-of-type) .item:first-of-type {
    @apply border-t-4 border-solid;
    border-color: var(--flyout-border);
}

.item {
    @apply flex justify-between px-4 py-2 items-center;
}

.item[data-disabled] {
    @apply opacity-50;
}

.item[data-selected="true"] {
    @apply bg-black bg-opacity-10;
}
</style>
