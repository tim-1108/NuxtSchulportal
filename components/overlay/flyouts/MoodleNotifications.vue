<script setup lang="ts">
import { performMoodleRequest } from "~/composables/moodle";

const list = useMoodleNotifications();

const isPerformingMarkOperation = ref(false);
const hasAnyUnread = computed(() => {
    if (!list.value) return false;
    return list.value.some((item) => !item.read);
});
async function markAllAsRead() {
    isPerformingMarkOperation.value = true;
    const id = AppID.MoodleNotifications;
    const creds = useMoodleCredentials();
    const data = await performMoodleRequest(id, "/api/moodle/notifications/mark-all-as-read", () => clearAppError(id), {
        user: creds.value.user
    });
    isPerformingMarkOperation.value = false;
    if (data === null) return;
    list.value.forEach((item) => (item.read = true));
}
</script>

<template>
    <div>
        <AppErrorDisplay v-if="hasAppError(AppID.MoodleNotifications)" :id="AppID.MoodleNotifications" :inlined="true"></AppErrorDisplay>
        <div v-else-if="list" class="grid gap-2">
            <ButtonDefault :disabled="isPerformingMarkOperation || !hasAnyUnread" :icon="['fas', 'check']" @click="markAllAsRead"
                >Alle Einträge als gelesen markieren</ButtonDefault
            >
            <details v-for="item of list" :key="item.id" name="notification" class="blurred-background borderless p-2 rounded-2xl relative">
                <summary class="grid">
                    <div class="rounded-full absolute -top-1 bg-red-500 px-2 right-2 shadow-lg" v-if="!item.read">ungelesen</div>
                    <div class="flex gap-2 items-center">
                        <div class="rounded-full p-1 bg-white">
                            <NuxtImg :src="item.icon"></NuxtImg>
                        </div>
                        <small>{{ item.timestamps.pretty }}</small>
                    </div>
                    <h2>
                        <PrettyWrap>
                            {{ item.subject }}
                        </PrettyWrap>
                    </h2>
                </summary>
                <PrettyWrap v-html="item.message.full"></PrettyWrap>
            </details>
            <p v-if="!list.length">Keine Einträge</p>
        </div>
        <div class="grid place-content-center" v-else>
            <InfiniteSpinner :size="30"></InfiniteSpinner>
        </div>
    </div>
</template>

<style scoped></style>
