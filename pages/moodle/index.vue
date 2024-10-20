<template>
    <div class="h-full">
        <AppErrorDisplay :id="AppID.Moodle" v-if="hasAppError(AppID.Moodle)"></AppErrorDisplay>
        <main v-else-if="credentials" class="w-screen max-w-screen p-5 grid gap-2">
            <section class="flex justify-between items-center">
                <h1 class="text-2xl">Dein Moodle</h1>
                <ButtonRoundedBlurred class="whitespace-nowrap h-8" :icon="['fas', 'bell']" ref="notifications" @click="toggleNotifications">
                    <font-awesome-icon v-if="hasAppError(AppID.MoodleNotifications)" :icon="['fas', 'triangle-exclamation']"></font-awesome-icon>
                    <span v-else-if="notifications">{{ notifications.length }}</span>
                    <InfiniteSpinner v-else :size="15"></InfiniteSpinner>
                </ButtonRoundedBlurred>
            </section>
            <section class="blurred-background rounded-xl">
                <ScrollFader direction="y" ref="course-list" class="p-4 max-w-full grid gap-2 overflow-x-hidden max-h-96 min-h-0">
                    <div class="flex justify-between items-center">
                        <h2>Deine Kurse</h2>
                        <FluidSelection
                            :options="coursesClassificationOptions"
                            :show-selected="true"
                            @update="(id) => switchCourseType(id as MoodleCoursesListClassification)"></FluidSelection>
                    </div>
                    <AppErrorDisplay :inlined="true" :id="AppID.MoodleCourseList" v-if="hasAppError(AppID.MoodleCourseList)"></AppErrorDisplay>
                    <div class="grid gap-2 w-full max-w-full" v-else-if="selCourses">
                        <template v-for="course of selCourses" :key="course.id">
                            <div class="course-item grid grid-cols-subgrid gap-2 min-w-0">
                                <div class="course-image h-14 rounded-lg" :style="{ '--background': `url(${proxyMoodleImage(course.image)})` }"></div>
                                <ScrollingText>{{ course.names.display }}</ScrollingText>
                            </div>
                        </template>
                        <p v-if="!selCourses.length" class="text-center">Keine Kurse</p>
                    </div>
                    <div class="grid place-content-center" v-else>
                        <InfiniteSpinner :size="30"></InfiniteSpinner>
                    </div>
                </ScrollFader>
            </section>
        </main>
        <FullPageSpinner v-else></FullPageSpinner>
    </div>
</template>
<script setup lang="ts">
import type { FluidSelectionOption } from "~/common/component-props";
import type { MoodleCoursesListClassification } from "~/common/moodle";
import ScrollFader from "~/components/ScrollFader.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import MoodleNotifications from "~/components/overlay/flyouts/MoodleNotifications.vue";

const notButton = useTemplateRef("notifications");
const notFlyout = ref<RegisteredFlyoutMetadata | null>(null);
async function toggleNotifications() {
    if (!notFlyout.value) {
        const data = await createFlyout({ style: "large", content: MoodleNotifications }, notButton.value?.$el);
        if (data === null) return;
        data.addCloseListener(() => (notFlyout.value = null));
        notFlyout.value = data;
        return;
    }
    notFlyout.value.requestClose();
}

const credentials = useMoodleCredentials();

const courses = useMoodleCourses();
const coursesEl = useTemplateRef("course-list");
const selCourseType = ref<MoodleCoursesListClassification>("all");
const selCourses = computed(() => courses.value.get(selCourseType.value));

const notifications = useMoodleNotifications();

onMounted(async () => {
    if (!credentials.value) return;
    fetchMoodleCourses(selCourseType.value).then(async () => {
        await nextTick();
        coursesEl.value?.update();
    });
    void fetchMoodleNotifications();
});

async function switchCourseType(id: MoodleCoursesListClassification) {
    selCourseType.value = id;
    await fetchMoodleCourses(id, false);
    await nextTick();
    coursesEl.value?.update();
}

interface CourseClassificationOption extends FluidSelectionOption {
    id: MoodleCoursesListClassification;
}

const coursesClassificationOptions: CourseClassificationOption[] = [
    { title: "Alle", id: "all", default: true },
    { title: "Laufende", id: "inprogress" },
    { title: "Zukünftige", id: "future" },
    { title: "Vergangene", id: "past" },
    { title: "Favoriten", id: "favourites" },
    { title: "Versteckt", id: "hidden" }
];
</script>

<style scoped>
.course-item {
    grid-template-columns: 5rem auto;
}
.course-image {
    @apply bg-center bg-cover;
    background-image: var(--background);
}
</style>
