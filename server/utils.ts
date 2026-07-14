import { H3Event } from "h3";

const DEFAULT_ERRORS: Record<string, string> = {
    "400": "Bad Request",
    "401": "Unauthorized",
    "403": "Forbidden",
    "404": "Not Found",
    "405": "Method Not Allowed",
    "410": "Gone",
    "418": "I'm a teapot",
    "429": "Too Many Requests",
    "500": "Internal Server Error",
    "502": "Bad Gateway",
    "503": "Service Not Available"
};
const SPECIAL_STATUS_MESSAGES: Record<string, string> = {
    "401": "Anmeldedaten ungültig",
    "429": "Du sendest zu viele Anfragen",
    "500": "Serverfehler",
    "503": "Momentan nicht verfügbar"
};

/**
 *
 * @param event The H3Event
 * @param status The HTTP status code
 * @param details The error_details key in the response
 * @param extra Any other data that should be attached to the response
 * @returns The response data, with type any by design to bypass requirements set
 */
export function setErrorResponseEvent(event: H3Event, status: number, details?: string | object, extra?: Record<string, any>): any {
    if (status === 200) throw new SyntaxError("Cannot set an error response if the status code is 200 (would cause no fail on client)");
    event.node.res.statusCode = status;
    return {
        error: true,
        error_details: details ?? (SPECIAL_STATUS_MESSAGES[status] ? SPECIAL_STATUS_MESSAGES[status] : `${status}: ${DEFAULT_ERRORS[status]}`),
        ...extra
    };
}

export const patterns = {
    USERNAME: /^([A-Z]+\.[A-Z]+(?:-[A-Z]+)?|[A-Z]{3})$/i,
    BIRTHDAY: /^(([12][0-9]|0[1-9]|3[0-1])\.(0[1-9]|11|12)\.(?:19|20)\d{2})$/,
    PW_RESET_CODE: /^([a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4})$/i,
    HEX_CODE: /^[a-f0-9]+$/,
    MOODLE_SESSION: /^[a-z0-9]{10}$/i,
    MOODLE_COOKIE: /^[a-z0-9]{26}$/,
    SESSION_OR_AUTOLOGIN: /^[a-f0-9]{64}$/,
    EMBEDDED_TOKEN: /(?:<input type="hidden" name="token" value=")([a-f0-9]{64})(?:"(?: \/)?>)/i,
    SPH_LOGIN_KEY: /^https:\/\/start.schulportal.hessen.de\/schulportallogin.php?k=[a-f0-9]{96}$/,
    OLD_SID: /^[a-z0-9]{26}$/,
    SID: /^[0-9a-f]{32}$/,
    NOTIFICATION_AUTH: /^[a-z0-9_-]{22}$/i,
    NOTIFICATION_P256DH: /^B[a-z0-9_-]+$/i,
    AES_PASSWORD: /^[A-Za-z0-9/\+=]{88}$/,
    DATE_YYYY_MM_DD_HYPHENS: /^20[12]\d\-(0[1-9]|1[0-2])\-(0[1-9]|[12]\d|3[01])$/,
    DATE_YYYY_MM_DD_HYPHENS_OR_YEAR: /^year|20[12]\d\-(0[1-9]|1[0-2])\-(0[1-9]|[12]\d|3[01])$/,
    SPH_DIRECT_MESSAGE_UUID: /^[0-9a-f]{32}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    SSO_LOCATION: /^https:\/\/login.schulportal.hessen.de\/saml\/singleSignOn\?SAMLRequest=[0-9a-z%&.=_-]*$/i,
    JSON_CHARSET_MIME_TYPE: /^(application\/json(; ?charset=utf-?8)?)$/,
    INTEGER: /^\d+$/
};

export const knownSubscriptionServices = [
    "android.googleapis.com",
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "updates-autopush.stage.mozaws.net",
    "updates-autopush.dev.mozaws.net",
    ".*\\.notify.windows.com",
    ".*\\.push.apple.com"
].map((service) => new RegExp(`^${service.replace("*", ".*")}$`, "i"));
export const isSubscriptionService = (host: string) => knownSubscriptionServices.some((pattern) => pattern.test(host));

/**
 * Parses the Cookie or set-cookie string from HTTP requests
 * and removes any Cookie Attributes like HttpOnly or SameSite
 * @param str The string recieved in HTTP requests
 * @returns a dictionary of the individual cookies
 */
export const parseCookie = (str: string) =>
    // All these attributes might or might not be capitalized, have some data
    // like "secure=1" set to it, so we need to parse all these things
    str
        .replace(/(expires|secure|httponly|samesite|domain|path)(=[^;]+)?[,;]?/gi, "")
        .split(";")
        .map((pair) => pair.split("="))
        .reduce((accumulated: { [key: string]: string }, pair) => {
            if (pair.length < 2) return accumulated;
            accumulated[decodeURIComponent(pair[0].trim())] = decodeURIComponent(pair[1].trim());
            return accumulated;
        }, {});

export const parseCookies = (strings: string[]) => parseCookie(strings.join("; "));

/**
 * Cleans a string from all empty spaces which may stop
 * a function from working with it correctly. This mostly
 * applies to Schulportal HTML requests. This includes a lot
 * of different RegEx patterns for empty strings
 * @param text String of which to remove empty spaces from
 * @returns Cleaned string
 */
export const removeBreaks = (text: string): string =>
    text
        .replace(/(\r\n|\n|\r)/gm, "<1br />")
        .replace(/<1br \/><1br \/><1br \/>/gi, "<1br /><2br />")
        .replace(/<1br \/><1br \/>/gi, "")
        .replace(/\<1br \/>/gi, " ")
        .replace(/\s+/g, " ")
        .replace(/<2br \/>/gi, "\n\n");

/**
 * Generate headers sent with every request to SPH. Includes this project as the user agent and
 * (if given) the client's IP address in the X-Forwarded-For header.
 * @param address The IP address of the client - if given
 * @returns A record which can be integrated into a headers field
 */
export function generateDefaultHeaders(address?: string | null) {
    return {
        "X-Forwarded-For": address ?? "",
        "User-Agent": "NuxtSchulportal (https://github.com/DerOwnerHD/NuxtSchulportal)"
    };
}

/**
 * Gets either the content of the Authorization header or the query key "token",
 * either one of these may contain the SPH token (sid cookie) needed for most requests.
 * @param event The H3Event given by Nuxt's event handler
 * @returns The cookie string or just null if it is not given or incorrect
 */
export function getAuthToken(event: H3Event): string | null {
    const { token } = getQuery<{ token?: string }>(event);
    const authorization = getRequestHeader(event, "Authorization");
    // Neither of them are given...
    if (typeof token !== "string" && typeof authorization !== "string") return null;
    // We can safely assume that one of them has to be correct
    if (!patterns.SID.test(token || authorization!)) return null;
    // Again, we can block this TS error as we know that one of them HAS to be a string
    return token || authorization!;
}

export const MIN_ALLOWED_SCHOOL = 1;
export const MAX_ALLOWED_SCHOOL = 9999;
/**
 * Loads the school ID from a request.
 *
 * This is not required by SPH by default but acts as a failsafe whenever they do not
 * want to use our sid to parse what we belong to (At least it seems like that).
 * If SPH does not wish to do that, they give us a 302 with an invalid sid inside Set-Cookie (FOR SOME REASON).
 *
 * **Only** when adding the school (i) cookie, this is (of current testing) prevented.
 *
 * Should this function return null, the request handler is expected to not send
 * such a cookie whats-o-ever.
 * If the request might then fail, there is another detection for that in place
 * (302 with location to "/" and Set-Cookie with sid => detection from that)
 * @param event The H3 event given by Nuxt
 * @param body An optional body sent by, i.e. POST requests
 * @param stringify Directly format it according to the needs of the Cookie header (i=school) or an completely empty string when null (Default is true)
 * @returns The school ID, if in request and valid
 */
export function getOptionalSchool(event: H3Event, body?: any, stringify: boolean = true) {
    const { school } = getQuery<{ school: string }>(event);
    // The school might also in POST requests be included inside the body.
    // (/login has that but that does not use this routine)
    const schoolInBody = typeof body === "object" && body != null ? body.school : null;
    // The query takes priority, it is far less likely for a body to even exist
    const parsed = parseInt(school ?? schoolInBody);
    if (isNaN(parsed) || parsed > MAX_ALLOWED_SCHOOL || parsed < MIN_ALLOWED_SCHOOL) return stringify ? "" : null;
    return stringify ? `i=${parsed}` : parsed;
}

export interface BasicResponse {
    error: boolean;
    error_details?: string | Record<string, any>;
    /**
     * Used when a rate limit occurs.
     */
    next_request_after?: number;
}

export const STATIC_STRINGS = {
    INVALID_TOKEN: "Token not provided or malformed",
    CONTENT_TYPE_NO_JSON: 'Expected "application/json" as "content-type" header',
    MIME_JSON: "application/json",
    INVALID_JSON: "Failed to parse JSON body",
    MOODLE_SCHOOL_NOT_EXIST: "Diese Schule unterstützt kein Moodle",
    ROUTE_LOCKED: "Route gesperrt",
    PASSWORD_RESET_SET: "Lege dein Passwort fest"
};

export class PrevalidatedMap<K, V> extends Map<K, V> {
    constructor() {
        super();
    }
    public get(key: K) {
        return super.get(key) as V;
    }
}

/**
 * Executes the readBody function on a given event.
 *
 * Catches any errors when parsing and thus prevents Nuxt generating its own error response.
 * @param event The H3Event
 * @returns The body with the given definition or null if any error occured.
 */
export async function readBodySafe<T>(event: H3Event) {
    try {
        return await readBody<T>(event);
    } catch {
        return null;
    }
}
