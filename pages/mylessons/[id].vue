<template>
    <div class="h-full py-4">
        <AppErrorDisplay :id="AppID.MyLessonsCourse" v-if="hasAppError(AppID.MyLessonsCourse)"></AppErrorDisplay>
        <div v-else-if="courseData" class="content grid w-screen h-full gap-2">
            <InfoBox class="w-fit justify-self-center" type="error" v-if="!hasValidAESKeySet()">
                <span>Anwesenheiten sind nicht verfügbar</span>
                <ButtonRoundedBlurred @click="() => loadCourse(true)" :icon="['fas', 'arrow-rotate-right']"></ButtonRoundedBlurred>
            </InfoBox>
            <header class="grid items-center justify-center gap-2 w-screen px-4">
                <div class="h-12 grid relative w-fit">
                    <NuxtImg class="h-12" src="icons/folder.svg"></NuxtImg>
                    <font-awesome-icon
                        class="absolute justify-self-center drop-shadow-sm text-lg top-6 opacity-70"
                        v-if="icon"
                        :icon="icon"></font-awesome-icon>
                </div>
                <ScrollingText :start-delay="3000" :pixels-per-second="50">
                    <h1 class="text-3xl">
                        {{ courseData.subject }}
                    </h1>
                </ScrollingText>
            </header>
            <main class="min-h-0 grid" ref="main">
                <div
                    v-if="selectedFooterItem === 0"
                    class="lessons-container flex w-screen overflow-scroll px-10 min-h-72"
                    ref="lesson-container"
                    @touchstart.passive="isTouching = true"
                    @scroll.passive="updateScroll"
                    @scrollend.passive="endScroll()">
                    <DeckCard v-for="lesson of courseData.lessons" class="!p-0">
                        <MyLessonsCard :lesson="lesson" :course="courseData.id"></MyLessonsCard>
                    </DeckCard>
                    <p class="text-center w-full place-self-center" v-if="!courseData.lessons.length">Keine Stunden geladen</p>
                </div>
                <ItemCounter v-if="selectedFooterItem === 0" :items="counters" :index="selected" @move="updateSelectedLesson"></ItemCounter>
                <div v-else-if="selectedFooterItem === 1" class="w-screen h-full px-12 grid max-h-full overflow-y-auto">
                    <table class="w-full h-fit" v-if="courseData.attendance && Object.keys(courseData.attendance).length">
                        <thead>
                            <tr>
                                <th>Typ</th>
                                <th>Menge</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="key of Object.keys(courseData.attendance)">
                                <td>{{ key }}</td>
                                <td>{{ courseData.attendance[key] }}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p v-else class="text-center">Keine Anwesenheiten verfügbar</p>
                    <ButtonRoundedBlurred class="self-end" :icon="['fas', 'up-right-from-square']" @click="navigateTo('/mylessons-attendance')"
                        >Zur Erklärung</ButtonRoundedBlurred
                    >
                </div>
            </main>
            <footer class="blurred-background rounded-3xl w-fit p-2 justify-self-center">
                <FluidQuickSwitch :options="footerOptions" @update="switchFooterItem"></FluidQuickSwitch>
            </footer>
        </div>
        <FullPageSpinner v-else></FullPageSpinner>
    </div>
</template>

<script setup lang="ts">
import type { MyLessonsCourse } from "~/common/mylessons";
const route = useRoute();
const courseId = route.params.id as string;
const courseData = ref<MyLessonsCourse | null>(null);
/**
 * Only if the user has activly touched the container/screen before the scrollend
 * event was fired, the card will be scrolled to.
 *
 * This prevents jittering when the event is fired, the closest card is scrolled to
 * and another scrollend event is fired (this sometimes triggers a loop of jittering between
 * two cards that slowly clears but is really ugly).
 */
const isTouching = ref(false);
const NUMBER_PATTERN = /^\d{1,7}$/;
const icon = computed(() => {
    if (!courseData.value) return null;
    return findIconForMyLessonsCourse(courseData.value.subject ?? "");
});
const selected = ref(0);
const counters = computed(() => {
    if (!courseData.value) return [];
    return courseData.value.lessons.map((x) => {
        return {
            title: x.topic ?? "",
            subtitle: relativeOrAbsoluteDateFormat(x.date ?? "", "day-month-short")
        };
    });
});
const lessonContainer = useTemplateRef("lesson-container");
function updateSelectedLesson(lesson: number) {
    selected.value = lesson;
    if (!lessonContainer.value) return;
    const child = lessonContainer.value.querySelector<HTMLElement>(`.deck-card:nth-child(${lesson + 1})`);
    if (child === null) return;
    child.style.transitionDuration = "0ms";
    child.style.scale = "1";
    [lesson - 1, lesson + 1].map(async (x) => {
        const child = lessonContainer.value!.children[x] as HTMLElement;
        if (!child) return;
        // These cards are supposed to switch instantly,
        // having a transition in place destroys this
        child.style.transitionDuration = "0ms";
        child.style.scale = "0.85";
        await nextTick();
        child.style.transitionDuration = "";
    });
    child.scrollIntoView({ behavior: "instant", inline: "center" });
    child.style.transitionDuration = "";
}
onMounted(() => {
    loadCourse();
    if (!isEventHandlerRegistered.value) {
        window.addEventListener("resize", handleResize);
        isEventHandlerRegistered.value = true;
    }
    handleResize();
});
onUnmounted(() => {
    clearAppError(AppID.MyLessonsCourse);
    window.removeEventListener("resize", handleResize);
    isEventHandlerRegistered.value = false;
});
const isEventHandlerRegistered = ref(false);
async function handleResize() {
    await useWait(100);
    updateScroll();
    await useWait(100);
    endScroll(true);
}

const selectedSemester = ref(useCurrentSemester());

async function loadCourse(overwrite?: boolean) {
    clearAppError(AppID.MyLessonsCourse);
    if (!NUMBER_PATTERN.test(courseId)) return createAppError(AppID.MyLessonsCourse, "Ungültige ID", loadCourse);

    const id = parseInt(courseId);
    const map = useMyLessonsCourseDetails();

    await fetchMyLessonsCourse(id, selectedSemester.value, overwrite);
    if (hasAppError(AppID.MyLessonsCourse) || !map.value.has(id)) return;
    courseData.value = map.value.get(id)!;
}

const CARD_WIDTH = 288;
const CARD_CENTER = CARD_WIDTH / 2;
watch(courseData, async () => {
    await useWait(100);
    window.removeEventListener("resize", handleResize);
    isEventHandlerRegistered.value = false;
    await handleResize();
    if (!isEventHandlerRegistered.value) {
        window.addEventListener("resize", handleResize);
        isEventHandlerRegistered.value = true;
    }
});

/**
 * This is a Safari fix. Whenever the user is scrolling, we'd expect
 * a scroll event every few ms. So when there hasn't been any for a
 * pretty long time, we can safely assume there is no scroll action.
 */
const MAX_SCROLL_INTERVAL = 200;
// Contains the index of the card with the largest scale
const closestCard = ref({ index: 0, scale: 0 });
const scrollTimeout: Ref<NodeJS.Timeout | undefined> = ref();
function updateScroll() {
    if (!lessonContainer.value) return;
    const cards = Array.from(lessonContainer.value.querySelectorAll<HTMLElement>(".deck-card"));
    const screenCenter = window.innerWidth / 2;
    closestCard.value.scale = 0;
    // We find the card with the biggest scale at the moment
    // If this is the last time the scroll event fires, the scrollend
    // event handler will scroll to that card. The current card is reset
    // every scroll event and is recalculated. Cards outside a certain
    // area have their scale set to 0 (performance)
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const dimensions = card.getBoundingClientRect();
        const cardCenter = dimensions.left + CARD_CENTER;
        // The distance from the center of the screen
        const cardDistance = Math.abs(screenCenter - cardCenter);
        // If the card has a distance greater than three times a card width, the scale is set to the min
        // -> only the closest cards are actually processed
        // We scale inside the area of 1.0 to 0.85 scale, depending on the distance from center
        const scale = cardDistance > 3 * CARD_WIDTH ? 0.85 : clampNumber(1 - 0.15 * (cardDistance / window.innerWidth), 0.85, 1);
        if (closestCard.value.scale < scale) closestCard.value = { scale, index: i };
        card.style.scale = scale > 0.99 ? "1" : scale.toFixed(3);
    }
    selected.value = closestCard.value.index;
    clearTimeout(scrollTimeout.value);
    // This might fire twice, it really isn't important though
    scrollTimeout.value = setTimeout(endScroll, MAX_SCROLL_INTERVAL);
}
// The scrollend event does not exist on Safari *sigh*.
// https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event#browser_compatibility
// => This causes these devices to fail to snap to any element
// The bottom counter is however refreshed every scroll event, thus
// it is not affected by this annoying thing.
function endScroll(bypassTouchRequirement?: boolean) {
    if (!isTouching.value && !bypassTouchRequirement) return;
    isTouching.value = false;
    clearTimeout(scrollTimeout.value);
    if (!lessonContainer.value) return;
    const child = lessonContainer.value.querySelector(`.deck-card:nth-child(${closestCard.value.index + 1})`);
    if (child === null) return;
    child.scrollIntoView({ behavior: "smooth", inline: "center" });
    selected.value = closestCard.value.index;
}

const mainElement = useTemplateRef("main");
const footerOptions = computed(() => [{ title: "Stunden", widget: courseData.value?.lessons.length }, { title: "Anwesenheit" }]);
const selectedFooterItem = ref(0);
async function switchFooterItem(index: number) {
    if (!mainElement.value) return (selectedFooterItem.value = index);
    const duration = 200;
    const animation = mainElement.value.animate({ opacity: "0" }, { duration, fill: "forwards" });
    await useWait(duration);
    selectedFooterItem.value = index;
    await nextTick();
    animation.reverse();
    await useWait(duration);
    animation.cancel();
    await handleResize();
}
</script>

<style scoped>
header {
    grid-template-columns: max-content auto;
}
.content {
    grid-template-rows: auto 1fr;
}
main {
    grid-template-rows: 1fr min-content;
}
.deck-card {
    @apply h-full max-h-full overflow-y-scroll;
    transition: scale 100ms !important;
    background: radial-gradient(#302e44, #302f37) center;
}
</style>
