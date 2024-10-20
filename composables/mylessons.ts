import type { MyLessonsAllCourses, MyLessonsCourse } from "~/common/mylessons";
import type { IconDefinition } from "~/common";

export async function fetchMyLessonsCourses() {
    const key = (await useAESKey()) ?? undefined;
    const token = useToken();
    const session = useSession();
    clearAppError(AppID.MyLessons);
    try {
        const response = await $fetch("/api/mylessons/courses", {
            query: {
                school: school.value,
                token: token.value,
                session: session.value,
                key
            }
        });
        useMyLessonsCourses().value = { courses: response.courses, expired: response.expired };
        useNotifications().value.set(
            AppID.MyLessons,
            response.courses.filter((course) => course.last_lesson?.homework && !course.last_lesson.homework.done).length
        );
    } catch (error) {
        createAppError(AppID.MyLessons, error, fetchMyLessonsCourses);
        await useReauthenticate(error);
    }
}

export const useMyLessonsCourses = () => useState<MyLessonsAllCourses>("mylessons-courses");

export const useSelectedMyLessonsCourse = () => useState<MyLessonsCourse>("selected-mylessons-course");

export const MYLESSONS_ICON_IDENTIFIERS: { icon: IconDefinition; identifiers: string[] }[] = [
    { icon: ["fas", "landmark"], identifiers: ["politik", "wirtschaft", "powi"] },
    { icon: ["fas", "magnet"], identifiers: ["phy"] },
    { icon: ["fas", "keyboard"], identifiers: ["info"] },
    { icon: ["fas", "square-root-variable"], identifiers: ["mathe"] },
    { icon: ["fas", "flask-vial"], identifiers: ["che"] },
    { icon: ["fas", "hands-praying"], identifiers: ["reli"] },
    { icon: ["fas", "earth-americas"], identifiers: ["geo", "erd"] },
    { icon: ["fas", "language"], identifiers: ["engl", "spanisch", "franz", "latein", "griech", "russisch"] },
    { icon: ["fas", "masks-theater"], identifiers: ["ds", "theater", "darstellendes spiel"] },
    { icon: ["fas", "running"], identifiers: ["sport"] },
    { icon: ["fas", "pen"], identifiers: ["deutsch"] },
    { icon: ["fas", "monument"], identifiers: ["geschi"] }
];

export function findIconForMyLessonsCourse(name: string): IconDefinition | undefined {
    const group = MYLESSONS_ICON_IDENTIFIERS.find((group) => group.identifiers.some((identifier) => name.toLowerCase().includes(identifier)));
    return group?.icon;
}

export const useCurrentSemester = () => parseInt(useRuntimeConfig().public.currentSemester as string);
export const useMyLessonsCourseDetails = () => useState("mylessons-course-details", () => new Map<number, MyLessonsCourse>());

export async function fetchMyLessonsCourse(id: number, semester?: number, overwrite: boolean = false) {
    const courses = useMyLessonsCourseDetails();
    const session = useSession();
    const token = useToken();
    const key = (await useAESKey()) ?? undefined;
    if (overwrite) courses.value.delete(id);
    else if (courses.value.has(id) && !overwrite) return;
    clearAppError(AppID.MyLessonsCourse);
    try {
        const response = await $fetch("/api/mylessons/course", {
            query: {
                session: session.value,
                token: token.value,
                school: school.value,
                semester: semester ?? useCurrentSemester(),
                id,
                key
            }
        });
        const { error, error_details, ...data } = response;
        void courses.value.set(id, data);
    } catch (error) {
        createAppError(AppID.MyLessonsCourse, error, () => fetchMyLessonsCourse(id, semester, overwrite));
        await useReauthenticate(error);
    }
}

export const myLessonsFlyout = computed<FlyoutGroup[]>(() => {
    const courses = useMyLessonsCourses();
    if (!courses.value) return [];

    const courseItems = courses.value.courses.map((course) => {
        return {
            title: course.subject ?? "",
            icon: findIconForMyLessonsCourse(course.subject ?? ""),
            action: () => navigateTo(`/mylessons/${course.id}`)
        };
    });

    return [{ items: courseItems }];
});
