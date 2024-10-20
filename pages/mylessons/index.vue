<template>
    <div class="h-full">
        <AppErrorDisplay :id="AppID.MyLessons" v-if="hasAppError(AppID.MyLessons)"></AppErrorDisplay>
        <div class="grid py-4 px-2" v-else-if="courses">
            <NuxtLink class="item grid gap-2 rounded-md p-2 items-center" v-for="(course, index) of courses.courses" :to="`/mylessons/${course.id}`">
                <div class="h-16 relative grid">
                    <NuxtImg class="h-full" src="icons/folder.svg"></NuxtImg>
                    <font-awesome-icon
                        v-if="icons[index]"
                        class="absolute justify-self-center drop-shadow-sm text-2xl top-7 opacity-70"
                        :icon="icons[index]"></font-awesome-icon>
                </div>
                <div class="description grid overflow-x-clip min-w-0 w-full">
                    <ScrollingText :start-delay="3000">
                        <h1>
                            {{ course.subject }}
                        </h1>
                    </ScrollingText>
                    <div v-if="course.last_lesson" class="min-w-0 flex gap-2 items-center p-1">
                        <span class="widget blurred-background whitespace-nowrap">{{
                            relativeOrAbsoluteDateFormat(course.last_lesson.date ?? "", "day-month-short")
                        }}</span>
                        <span class="widget bg-red-500" v-if="course.last_lesson.homework && !course.last_lesson.homework.done">HA</span>
                        <ScrollingText :start-delay="3000" class="text-xs">{{ course.last_lesson.topic }}</ScrollingText>
                    </div>
                </div>
            </NuxtLink>
        </div>
        <FullPageSpinner v-else></FullPageSpinner>
    </div>
</template>

<script setup lang="ts">
const courses = useMyLessonsCourses();
const icons = computed(() => {
    if (!courses.value) return [];
    return courses.value.courses.map((course) => findIconForMyLessonsCourse(course.subject ?? ""));
});
</script>

<style scoped>
.item {
    grid-template-columns: auto 1fr;
    transition-property: background, transform;
    transition-duration: 250ms;
}
.item:hover:active {
    transform: scale(98%);
    background: #ffffff30;
}
.description {
    grid-template:
        "a a a"
        "b b c";
    > *:nth-child(1) {
        grid-area: a;
    }
    > *:nth-child(2) {
        grid-area: b;
    }
    > *:nth-child(3) {
        grid-area: c;
    }
}
</style>
