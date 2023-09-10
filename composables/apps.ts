import { Credentials } from "./auth";

export interface VertretungsDay {
    date: string;
    day_of_week: string;
    relative: "heute" | "morgen" | "";
    vertretungen: Vertretung[];
    news: string[];
}

export interface Vertretungsplan {
    days: VertretungsDay[];
    last_updated: string;
}

export interface Vertretung {
    lessons: {
        list: number[];
        from: number;
        to: number;
    };
    class: string | null;
    substitute: string | null;
    teacher: string | null;
    subject: string | null;
    subject_old: string | null;
    room: string | null;
    note: string | null;
}

interface VertretungenResponse {
    error: boolean;
    days: VertretungsDay[];
    last_updated: string;
}

interface MoodleConversationsResponse {
    error: boolean;
    error_details?: any;
    conversations: MoodleConversation[];
}

export interface MoodleConversation {
    id: number;
    name: string;
    subname: string | null;
    icon: string | null;
    type: number;
    memberCount: number;
    muted: boolean;
    favorite: boolean;
    unread: number | null;
    members: MoodleMember[];
    messages: MoodleMessage[];
    canDeleteMessagesForEveryone: boolean;
}

export interface MoodleMessage {
    id: number;
    author: number;
    text: string;
    timestamp: number;
}

export interface MoodleMember {
    id: number;
    name: string;
    profile: string;
    avatar: {
        small: string;
        default: string;
    };
    online: boolean | null;
    showStatus: boolean;
    blocked: boolean;
    contact: boolean;
    deleted: boolean;
    abilities: {
        message: boolean;
        messageIfBlocked: boolean;
    };
    requiresContact: boolean;
    contactRequests: [];
}

export enum APIFetchError {
    Unauthorized = 401,
    Forbidden = 403,
    TooManyRequests = 429,
    ServerError = 500
}

export interface StundenplanLesson {
    lessons: number[];
    classes: StudenplanClass[];
}

interface StudenplanClass {
    teacher: string;
    room: string;
    name: string;
}

export interface Stundenplan {
    days: StundenplanDay[];
    start_date: string;
    end_date: string | null;
    lessons: number[][][];
    current: boolean;
}

interface StundenplanDay {
    name: "Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag";
    lessons: StundenplanLesson[];
}

interface AppErrorState {
    [app: string]: string | null;
}

export const useSheetState = () => useState<{ open: string[] }>("sheets");
export const useAppErrors = () => useState<AppErrorState>("app-errors");

/**
 * Fetches the data of the Vertretungsplan from the API
 * @returns A list of all the days listed on the plan or null - which would indicate that the client should reauthenticate
 */
export const useVplan = async (): Promise<{ last_updated: string; days: VertretungsDay[] } | string> => {
    const token = useToken().value;
    if (!token) return "401: Unauthorized";

    const { data, error: fetchError } = await useFetch<VertretungenResponse>("/api/vertretungen", {
        method: "GET",
        headers: { Authorization: token },
        retry: false
    });

    if (fetchError.value !== null) return fetchError.value.data.error_details || "Serverfehler";

    if (data.value === null) return "Serverfehler";

    const { error, ...plan } = data.value;

    return plan;
};

export const useStundenplan = async (): Promise<Stundenplan[] | string> => {
    const token = useToken().value;
    if (!token) return "401: Unauthorized";

    const { data, error: fetchError } = await useFetch<{ error: boolean; error_details?: any; plans: Stundenplan[] }>("/api/stundenplan", {
        method: "GET",
        headers: { Authorization: token },
        retry: false
    });

    if (fetchError.value !== null) return fetchError.value.data.error_details || "Serverfehler";

    if (data.value === null) return "Serverfehler";

    return data.value?.plans;
};

export const useConversations = async (type?: "favorites" | "groups"): Promise<MoodleConversation[] | string> => {
    const credentials = useMoodleCredentials().value;
    if (!credentials) return "401: Unauthorized";

    const { data, error } = await useFetch<MoodleConversationsResponse>("/api/moodle/conversations", {
        method: "GET",
        query: {
            ...credentials,
            school: useCredentials<Credentials>().value.school,
            type
        },
        retry: false
    });

    if (error.value !== null) return error.value.data.error_details || "Serverfehler";

    if (data.value === null) return "Serverfehler";

    return data.value.conversations;
};

export const useSheet = (sheet: string, open?: boolean) => {
    const sheets = useSheetState();

    if (sheets.value.open.includes(sheet) && open) return;
    if (!sheets.value.open.includes(sheet)) return sheets.value.open.push(sheet);

    const index = sheets.value.open.indexOf(sheet);
    sheets.value.open.splice(index, 1);
};
