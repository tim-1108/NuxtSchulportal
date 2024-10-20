<template>
    <div class="h-full min-h-screen">
        <div
            id="background"
            class="fixed top-0 z-[-1] overflow-hidden bg-center bg-no-repeat w-screen h-screen"
            :style="{ '--gradient-color': appBackgroundGradient }">
            <div id="overlay"></div>
        </div>
        <div class="grid h-screen py-4 max-h-[100vh] w-screen overflow-y-scroll" id="content">
            <SPHHeader></SPHHeader>
            <main class="max-w-screen mb-24" :class="{ 'min-h-0': !isPageScrollable }">
                <slot />
            </main>
            <footer class="flex justify-center w-screen z-40">
                <ClientOnly>
                    <DockContainer v-if="isLoggedIn"></DockContainer>
                </ClientOnly>
            </footer>
        </div>
        <aside class="fixed h-screen w-screen top-0 left-0 z-[200] pointer-events-none" id="overlay-wrapper">
            <div v-for="[uuid, meta] of flyoutMap" :key="uuid">
                <component
                    :is="meta.vnode"
                    :ref="
                        (el: any) => {
                            meta.callback(el);
                        }
                    "
                    :key="uuid"></component>
            </div>
        </aside>
    </div>
</template>

<script setup lang="ts">
import "~/composables/prototype";
import { type RouteLocationNormalized } from "vue-router";

const flyoutMap = useFlyoutMap();

const isPageScrollable = useScrollabilityStatus();
useRouter().afterEach(async (route) => {
    await nextTick();
    await updatePageScrollability(route);
    window?.scrollTo(0, 0);
});

async function updatePageScrollability(route?: RouteLocationNormalized) {
    const { path } = route ?? useRoute();
    const isNonScrollable = useNonScrollablePages().some((pattern) => pattern.test(path));
    await nextTick();
    isPageScrollable.value = !isNonScrollable;
}

const apps = appRegistry.value;

onMounted(() => {
    updatePageScrollability();
    window.addEventListener("contextmenu", (event) => event.preventDefault());
    if (!isLoggedIn.value) return;
    for (const app of apps) {
        if (app.load_on_mount) app.load_function();
    }
});

const backgroundGradients = useBackgroundGradients();

const appBackgroundGradient = computed(() => {
    const site =
        backgroundGradients.find((site) => site.type === "page" && site.pattern?.test(useRoute().path)) ??
        backgroundGradients.find((site) => site.type === "default");
    const channels = getRGBValues(site?.color ?? 0x000000);
    return combineRGBValues(multiplyRGBValues(channels, useBackgroundColorMultiplier()));
});
</script>

<style scoped>
#content {
    grid-template-rows: auto 1fr auto;
}
@property --gradient-color {
    syntax: "<color>";
    initial-value: #030303;
    inherits: false;
}
#background {
    background-image: radial-gradient(var(--gradient-color), #030303);
    transition: --gradient-color 500ms;
}
#background #overlay {
    background: linear-gradient(to bottom, #03030375, #03030399);
    height: inherit;
    width: inherit;
}
</style>
