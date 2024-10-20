<template>
    <div class="grid gap-4 justify-center pt-4">
        <section id="login" class="blurred-background relative">
            <div class="grid w-full px-5 justify-center">
                <div class="flex justify-between mb-1 w-full">
                    <h1>Anmeldung</h1>
                    <div
                        v-if="state !== Status.LoginSuccessful"
                        class="blurred-background borderless rounded-full px-4 flex items-center"
                        @click="showSchoolSearch">
                        <font-awesome-icon :icon="['fas', 'magnifying-glass']"></font-awesome-icon>
                        <span class="ml-2">Schule</span>
                    </div>
                </div>
                <div v-if="state !== Status.LoginSuccessful" stage="1" class="login-stage">
                    <form id="login" @submit.prevent="login" class="flex justify-center">
                        <div id="form-wrapper" class="grid w-full place-content-center">
                            <div class="flex">
                                <input
                                    type="text"
                                    :disabled="state !== Status.None"
                                    v-model="credentials.username"
                                    name="username"
                                    placeholder="Name (Vorname.Nachname)"
                                    autofocus
                                    autocomplete="username"
                                    required />
                                <input
                                    class="w-20 text-center"
                                    min="1"
                                    max="206568"
                                    :disabled="state !== Status.None"
                                    type="number"
                                    v-model="credentials.school"
                                    name="school"
                                    placeholder="Schule"
                                    required />
                            </div>
                            <div class="relative flex items-center">
                                <input
                                    :type="passwordVisible ? 'text' : 'password'"
                                    :disabled="state !== Status.None"
                                    v-model="credentials.password"
                                    placeholder="Passwort"
                                    name="password"
                                    required
                                    autocomplete="current-password"
                                    class="flex-auto" />
                                <font-awesome-icon
                                    id="login-password-toggle"
                                    class="mx-2"
                                    @mousedown="passwordVisible = !passwordVisible"
                                    :icon="['fas', passwordVisible ? 'eye-slash' : 'eye']"></font-awesome-icon>
                            </div>
                            <button :disabled="state !== Status.None">
                                <div v-if="state !== Status.LoggingIn">
                                    <font-awesome-icon class="mr-1" :icon="['fas', 'arrow-right-from-bracket']"></font-awesome-icon>
                                    <span>Anmelden</span>
                                </div>
                                <div v-else class="spinner" style="--size: 1.5rem"></div>
                            </button>
                        </div>
                    </form>
                </div>
                <div v-else-if="state === Status.LoginSuccessful" class="login-stage grid place-content-center text-center" stage="2">
                    <div class="info">Deine Anmeldedaten bleiben gespeichert</div>
                    <font-awesome-icon class="text-3xl w-full justify-center mt-2" :icon="['fas', 'check']"></font-awesome-icon>
                    <p>Login erfolgreich</p>
                    <small>Die Seite wird gleich neu geladen</small>
                </div>
                <div class="error mt-2" v-if="errors.login.message">
                    <span>
                        {{ errors.login.message }}
                    </span>
                </div>
            </div>
        </section>
        <section id="reset" class="blurred-background">
            <div class="w-full grid justify-center">
                <h1 class="mb-1 text-center">Passwort vergessen</h1>
                <div class="grid my-2 text-center">
                    <div
                        v-if="![Status.ResetCodeVerification, Status.VerifyingCode, Status.ResetDone].includes(state)"
                        class="reset-stage grid gap-2"
                        stage="1">
                        <div class="flex justify-center">
                            <div class="warning">Nur mit hinterlegter E-Mail möglich</div>
                        </div>
                        <LegacySelectBox :options="resetTypeOptions" :disabled="state !== Status.None"></LegacySelectBox>
                        <form id="reset" @submit.prevent="beginReset" class="flex justify-center">
                            <div id="form-wrapper" class="grid w-full place-content-center">
                                <input
                                    class="w-60"
                                    :disabled="state !== Status.None"
                                    type="text"
                                    name="birthday"
                                    v-model="reset.birthday"
                                    placeholder="Geburtsdatum (dd.mm.yyyy)"
                                    required />
                                <button :disabled="state !== Status.None">
                                    <div v-if="state !== Status.ResetSending">Weiter</div>
                                    <div v-else class="spinner" style="--size: 1.5rem"></div>
                                </button>
                            </div>
                        </form>
                    </div>
                    <div v-else-if="[Status.ResetCodeVerification, Status.VerifyingCode].includes(state)" class="reset-stage" stage="2">
                        <div class="flex justify-center mb-2">
                            <div class="info">Du hast keinen Code erhalten?<br />Kontaktiere deine Schule</div>
                        </div>
                        <p class="my-2 leading-4">Du hast einen Code per E-Mail erhalten<br />Dieser ist für 10 Minuten gültig</p>
                        <form name="reset-code" class="flex justify-center" @input="handleResetInput" @keyup="handleResetInput">
                            <input v-for="i in 4" required type="text" :disabled="state === Status.VerifyingCode" />
                            <span>-</span>
                            <input v-for="i in 4" required type="text" :disabled="state === Status.VerifyingCode" />
                            <span>-</span>
                            <input v-for="i in 4" required type="text" :disabled="state === Status.VerifyingCode" />
                        </form>
                    </div>
                    <div class="reset-stage" v-else-if="state === Status.ResetDone" stage="3">
                        <div class="flex justify-center mb-2">
                            <div class="warning">Dein neues Passwort ist nach<br />ungefähr 10 Minuten nutzbar</div>
                        </div>
                        <p>
                            Dein neues Passwort ist<br /><b
                                ><u>{{ reset.password }}</u></b
                            >
                        </p>
                        <p>Bei deiner nächsten Anmeldung <b>online</b><br />musst du ein neues Passwort festlegen</p>
                        <button class="button-with-symbol" @click="copyNewPassword">
                            <font-awesome-icon :icon="['fas', 'clipboard']"></font-awesome-icon>
                            <span>Kopieren</span>
                        </button>
                        <button class="button-with-symbol" @click="openDefaultLogin">
                            <font-awesome-icon :icon="['fas', 'up-right-from-square']"></font-awesome-icon>
                            <span>Öffnen</span>
                        </button>
                        <button class="button-with-symbol" onclick="location.reload()">
                            <font-awesome-icon :icon="['fas', 'arrow-rotate-right']"></font-awesome-icon>
                            <span>Neu laden</span>
                        </button>
                    </div>
                    <div class="error mt-2" v-if="errors.reset.message">
                        <span>
                            {{ errors.reset.message }}
                        </span>
                    </div>
                </div>
            </div>
        </section>
        <HighlightedLink class="sticky bottom-4 text-center" to="/status">Anmeldeprobleme? Zur Statusseite</HighlightedLink>
        <dialog id="school-search" class="text-white w-80 h-[60vh] place-content-center rounded-xl focus:outline-none">
            <div class="grid gap-2 p-4 h-full items-start grid-rows overflow-hidden grid-rows-header-main" v-if="search.loaded">
                <header class="w-full rounded-xl p-2 backdrop-blur-md flex min-h-0 shadow-md sticky">
                    <input v-model="searchQuery" type="text" class="w-full h-10 rounded-xl px-2 shadow-md" placeholder="Suche eine Schule..." />
                    <font-awesome-icon
                        @click="closeSchoolSearch"
                        class="blurred-background borderless p-1 rounded-full text-2xl aspect-square self-center ml-2"
                        :icon="['fas', 'xmark']"></font-awesome-icon>
                </header>
                <main id="schools" class="grid gap-2 pb-4 z-30 overflow-y-scroll h-fit max-h-full relative pt-2" v-if="search.results.length">
                    <div
                        class="bg-white bg-opacity-10 rounded-xl p-2 shadow-md"
                        @click="closeSchoolSearch(school.id)"
                        v-for="school in search.results">
                        <b>{{ school.id }}</b>
                        {{ school.name }}
                        <small>{{ school.town }}</small>
                    </div>
                </main>
                <footer class="text-center" v-else>
                    <span v-if="searchQuery === ''">Suche nach einem Ort oder einer Schule</span>
                    <span v-else-if="!search.results.length">Keine Ergebnisse gefunden</span>
                </footer>
            </div>
            <div v-else class="spinner" style="--size: 4rem"></div>
        </dialog>
    </div>
</template>

<script setup lang="ts">
import type { LegacySelectBoxOption } from "~/common/component-props";
import type { Nullable } from "~/common";
import type { ResetPasswordUserType } from "~/common/reset-password";

interface ResetTypeOption extends LegacySelectBoxOption {
    id: ResetPasswordUserType;
}
const resetTypeOptions: ResetTypeOption[] = [
    { id: "student", icon: ["fas", "child"], text: "Schüler", default: true },
    { id: "parent", icon: ["fas", "hands-holding-child"], text: "Eltern" },
    { id: "teacher", icon: ["fas", "user"], text: "Lehrer" }
];
const selectedResetType = ref<ResetPasswordUserType>("student");

// This only exists so that TypeScript doesn't complain about
// all those things that would otherwise be undefined when building
// the list there
interface School {
    id: number;
    name: string;
    town: number;
}
const credentials = ref<{ username: string; password: string; school: number | null }>({
    username: "",
    password: "",
    school: null
});
const reset = ref({
    birthday: "",
    token: "",
    sid: "",
    ikey: "",
    password: ""
});
enum Status {
    None,
    LoggingIn,
    LoginSuccessful,
    ResetSending,
    ResetCodeVerification,
    VerifyingCode,
    ResetDone
}
const passwordVisible = ref(false);
const state: Ref<Status> = ref(Status.None);
interface Search {
    loaded: boolean;
    schools: School[];
    results: School[];
}
const search = ref<Search>({
    loaded: false,
    schools: [],
    results: []
});
const searchQuery = ref("");

async function showSchoolSearch() {
    if (state.value !== Status.None) return;
    const dialog = document.querySelector<HTMLDialogElement>("dialog#school-search");
    dialog?.showModal();
    // All further processing is just for fetching the list
    if (search.value.loaded) return;
    try {
        const response = await fetch("/schools.json");
        const districts = await response.json();
        if (!Array.isArray(districts)) throw new TypeError("Expected to recieve list of districts");
        search.value = {
            ...search.value,
            schools: search.value.schools.concat(...districts.map((district) => district.schools as School[])),
            loaded: true
        };
    } catch (error) {
        console.error(error);
        dialog?.close();
    }
}
function closeSchoolSearch(id?: number) {
    const dialog = document.querySelector("dialog#school-search");
    if (!(dialog instanceof HTMLDialogElement)) return;
    searchQuery.value = "";
    search.value.results = [];
    dialog.close();
    if (typeof id !== "number") return;
    credentials.value.school = id;
}
/**
 * Rendering too many search items at once drastically impacts performance and is
 * not required in the slightest.
 */
const MAX_SEARCH_RESULTS = 20;
watch(searchQuery, (value) => {
    if (value === "") return (search.value.results = []);
    const regex = new RegExp(value, "i");
    search.value.results = search.value.schools.filter((school) => regex.test(school.name)).slice(0, MAX_SEARCH_RESULTS);
});

const errors = ref<{ [key: string]: { message: Nullable<string>; timeout?: NodeJS.Timeout } }>({
    login: { message: null },
    reset: { message: null }
});
function showErrorMessage(message: string, type: "login" | "reset" = "login") {
    clearTimeout(errors.value[type].timeout);
    errors.value[type] = {
        timeout: setTimeout(() => (errors.value[type].message = null), 2000),
        message
    };
}

async function login() {
    const { username, school } = credentials.value;
    if (!patterns.USERNAME.test(username)) return showErrorMessage("Nutzername ungültig");
    if (school === null || school < 1 || school > 206568 || !Number.isInteger(school)) return showErrorMessage("Schule ungültig");
    state.value = Status.LoggingIn;
    const { data, error } = await useFetch("/api/login", {
        method: "POST",
        body: credentials.value
    });
    if (error.value !== null) {
        state.value = Status.None;
        const { data, cause } = error.value;
        if (data?.cooldown) return showErrorMessage(`Bitte warte ${data.cooldown} Sekunde${data.cooldown > 1 ? "n" : ""}`);
        showErrorMessage(data?.error_details || cause);
        return;
    }

    // A cookie can only be set for at most one year
    const expiration = new Date();
    expiration.setFullYear(expiration.getFullYear() + 1);
    useCookie<{}>("credentials", { expires: expiration }).value = credentials.value;
    // @ts-ignore
    useToken().value = data.value?.token;
    // @ts-ignore
    useSession().value = data.value?.session;

    const card = document.querySelector("#login");
    if (!(card instanceof Element)) return;
    await resizeCard(card, { in: ".login-stage[stage='2']", out: ".login-stage[stage='1']" }, () => (state.value = Status.LoginSuccessful));
    // Using this, the auth middleware will recognize that we are, in fact, logged in and thus
    // will redirect us either to / or to the path given in the redirect parameter
    location.reload();
}

async function resizeCard(element: Element, content: { in: string; out: string }, trigger: Function) {
    element.querySelector(content.out)?.animate(
        {
            opacity: 0
        },
        250
    );
    const previousHeight = element.clientHeight;
    await useWait(250);
    await trigger();
    await nextTick();
    const height = element.clientHeight;
    element.querySelector(content.in)?.animate([{ opacity: 0 }, { opacity: 1 }], 250);
    element.animate([{ height: previousHeight + "px" }, { height: height + "px" }], 250);
    // This timeout is just so the function does not actually resolve
    // until all the animations are all done (if caller awaits this func)
    await useWait(250);
}

interface InitialResetResponse {
    error: boolean;
    error_details?: any;
    ikey: string;
    token: string;
    sid: string;
}
async function beginReset() {
    const { username, school } = credentials.value;
    if (!patterns.USERNAME.test(username)) return showErrorMessage("Trage deinen Nutznamen oben ein", "reset");
    if (school === null || school < 1 || school > 206568 || !Number.isInteger(school))
        return showErrorMessage("Trage deine Schule oben ein", "reset");
    if (!patterns.BIRTHDAY.test(reset.value.birthday)) return showErrorMessage("Geburtstag ungültig", "reset");
    state.value = Status.ResetSending;
    const { data, error } = await useFetch<InitialResetResponse>("/api/resetpassword", {
        method: "POST",
        body: {
            type: selectedResetType.value,
            username,
            school,
            birthday: reset.value.birthday
        }
    });
    if (error.value !== null) {
        state.value = Status.None;
        const { data, cause } = error.value;
        showErrorMessage(data?.error_details || cause, "reset");
        return;
    }
    // This should be impossible, as if data is null,
    // error shouldn't be null but TS does not know that...
    if (data.value === null) return (state.value = Status.None);
    const { ikey, token, sid } = data.value;
    reset.value = {
        ...reset.value,
        ikey,
        token,
        sid
    };
    const card = document.querySelector("#reset");
    if (!(card instanceof Element)) return;
    await resizeCard(card, { in: ".reset-stage[stage='2']", out: ".reset-stage[stage='1']" }, () => (state.value = Status.ResetCodeVerification));
}

async function handleResetInput(event: Event) {
    function getOtherElement(element: HTMLInputElement, action: "nextElementSibling" | "previousElementSibling"): HTMLInputElement | null {
        const other = element[action];
        if (other === null) return null;
        if (!(other instanceof HTMLInputElement)) {
            const otherSquared = other[action];
            if (!(otherSquared instanceof HTMLInputElement)) return null;
            return otherSquared;
        }
        return other;
    }
    if (!(event.target instanceof HTMLInputElement)) return;
    // Must be a keydown - we want to check for backspace
    if (event instanceof KeyboardEvent) {
        if (event.key !== "Backspace") return;
        const previous = getOtherElement(event.target, "previousElementSibling");
        if (previous === null) return;
        previous.focus();
        previous.value = "";
    }
    if (!(event instanceof InputEvent)) return;
    // Multiple characters have been pasted
    if (event.target.value.length > 1) {
        let element = event.target;
        const characters = element.value.replace(/-/g, "").split("");
        characters.every((character, index) => {
            element.value = character;
            const next = getOtherElement(element, "nextElementSibling");
            if (next === null) return false;
            element = next;
            if (index === characters.length - 1) element.focus();
            return true;
        });
    }
    // One character has been typed -> one forwards
    else getOtherElement(event.target, "nextElementSibling")?.focus();
    if (document.forms.namedItem("reset-code")?.checkValidity()) verifyResetCode();
}

interface FinalResetResponse {
    error: boolean;
    error_details?: any;
    password: string;
}
async function verifyResetCode() {
    let code = "";
    const satisfied = Array.from(document.querySelectorAll(".reset-stage[stage='2'] input")).every((element, index) => {
        if (!(element instanceof HTMLInputElement)) return true;
        const value = element.value.substring(0, 1);
        if (value === "") return false;
        code += `${value}${[3, 7].includes(index) ? "-" : ""}`;
        return true;
    });
    if (!satisfied) return;
    if (!/^([a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4})$/i.test(code)) return showErrorMessage("Code kann nicht gültig sein", "reset");
    state.value = Status.VerifyingCode;
    const { ikey, token, sid } = reset.value;
    const { data, error } = await useFetch<FinalResetResponse>("/api/resetpassword", {
        method: "PUT",
        body: {
            ikey,
            token,
            sid,
            code
        }
    });
    const card = document.querySelector("#reset");
    // We cannot risk the password getting lost just because it
    // couldn't find the element (how that would be possible I dunno)
    if (!(card instanceof Element)) {
        alert(data.value);
        return;
    }
    if (error.value !== null) {
        // This means we have just been rate limited and we do not want
        // to destroy the whole process so we just let the user try again
        if (error.value.status === 429) return showErrorMessage("Versuche es gleich erneut", "reset");
        await resizeCard(card, { in: ".reset-stage[stage='1']", out: ".reset-stage[stage='2']" }, () => (state.value = Status.None));
        const { data, cause } = error.value;
        showErrorMessage(data?.error_details ?? cause, "reset");
        return;
    }
    if (!data.value) return;
    reset.value.password = data.value.password;
    await resizeCard(card, { in: ".reset-stage[stage='3']", out: ".reset-stage[stage='2']" }, () => (state.value = Status.ResetDone));
}

function copyNewPassword() {
    window.navigator.clipboard.writeText(reset.value.password);
}
function openDefaultLogin() {
    window.open("https://login.schulportal.hessen.de/?i=" + credentials.value.school, "_blank");
}
</script>

<style scoped>
section {
    @apply py-4 rounded-2xl;
}
h1 {
    @apply text-2xl;
}
#form-wrapper > * {
    @apply my-1;
}
form {
    input {
        background: var(--light-white-gradient);
        @apply mx-1.5 rounded-md h-10 placeholder-gray-400 pl-2 shadow-md;
    }
    input:not([name="password"]) {
        @apply px-2;
    }
    button {
        @apply h-10 rounded-md mx-1.5 grid place-content-center hover:active:scale-[0.95];
        transition: transform 200ms;
        background: var(--sph-gradient);
        filter: drop-shadow(0px 0px 6px var(--sph-glow));
    }
    button:disabled {
        background: var(--light-white-gradient);
    }
}
.reset-stage[stage="2"] {
    input {
        @apply h-12 w-5 p-0 text-center mx-0.5;
    }
    span {
        @apply h-12 grid content-center;
    }
}
#school-search {
    background: var(--light-white-gradient);
    backdrop-filter: blur(50px);
    input {
        background: var(--light-white-gradient);
    }
    li {
        background: var(--light-white-gradient);
    }
    main {
        mask-image: linear-gradient(to bottom, transparent 0%, white 5%, white 95%, transparent 100%);
        mask-mode: alpha;
    }
}
</style>
