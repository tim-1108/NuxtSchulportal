import { defineRateLimit, getRequestAddress } from "~/server/ratelimit";
import {
    generateDefaultHeaders,
    patterns,
    removeBreaks,
    parseCookies,
    BasicResponse,
    STATIC_STRINGS,
    readBodySafe,
    setErrorResponseEvent
} from "../utils";
import { constants, publicEncrypt } from "crypto";
import cryptoJS from "crypto-js";
import { SPH_PUBLIC_KEY, generateUUID } from "../crypto";
import { SchemaEntryConsumer, validateBodyNew } from "../validator";
import { H3Event } from "h3";
// For some reason "Universität Kassel (Fachbereich 2) Kassel" has id 206568, like why?
const bodySchema: SchemaEntryConsumer = {
    username: { type: "string", required: true, max: 32 },
    password: { type: "string", required: true, max: 100 },
    school: { type: "number", required: true, max: 206568, min: 1 },
    autologin: { type: "boolean", required: false },
    legacy: { type: "boolean", required: false }
};

interface Response extends BasicResponse {
    /**
     * The sid cookie generated by start.schulportal.hessen.de.
     * This is most likely a PHPSESSID cookie, as they both are 26 chars long and follow the same format.
     */
    token: string;
    /**
     * The session represents the SPH-Session header, thus not being available using legacy login
     */
    session: string;
    /**
     * Represents the autologin token used to reauth at /api/autologin
     *
     * Not given on every request, but the client is supposed to know that if it does not supply autologin: true, it cannot expect to get it back.
     */
    autologin: string;
    /**
     * Only defined if the request failed multiple times.
     */
    cooldown?: number;
}

const rlHandler = defineRateLimit({ interval: 15, allowed_per_interval: 2 });

export default defineEventHandler<Promise<Response>>(async (event) => {
    if (getRequestHeader(event, "Content-Type") !== STATIC_STRINGS.MIME_JSON)
        return setErrorResponseEvent(event, 400, STATIC_STRINGS.CONTENT_TYPE_NO_JSON);

    const body = await readBodySafe<{ username: string; password: string; school: number; autologin?: boolean; legacy?: boolean }>(event);
    if (body === null) return setErrorResponseEvent(event, 400, STATIC_STRINGS.INVALID_JSON);
    const bodyValidation = validateBodyNew(bodySchema, body);
    if (bodyValidation.violations > 0 || bodyValidation.invalid) return setErrorResponseEvent(event, 400, bodyValidation);

    const rl = rlHandler(event);
    if (rl !== null) return rl;
    const address = getRequestAddress(event) as string;

    const { username, password, school, autologin, legacy } = body;
    if (legacy) return await attemptLegacyLogin(event, username, password, school, address);

    const requestForm = [
        `user=${encodeURIComponent(`${school}.${username}`)}`,
        `password=${encodeURIComponent(password)}`,
        `stayconnected=${+!!autologin}`
    ].join("&");

    try {
        const login = await fetch("https://login.bildung.hessen.de", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                ...generateDefaultHeaders(address)
            },
            body: requestForm,
            redirect: "manual"
        });

        if (login.status === 503) return setErrorResponseEvent(event, 503, "Wartungsarbeiten");

        if (!login.headers.getSetCookie().length) throw new ReferenceError("Expected a 'set-cookie' header from Schulportal");

        const cookies = parseCookies(login.headers.getSetCookie());
        const session = cookies["SPH-Session"];
        if (!session) {
            const html = removeBreaks(await login.text());
            const cooldownMatch = html.match(/(?:<span id="authErrorLocktime">)([0-9]{1,2})(?:<\/span>)/i);
            if (cooldownMatch === null) return setErrorResponseEvent(event, 401);
            const cooldown = parseInt(cooldownMatch[1]);
            return setErrorResponseEvent(event, 401, undefined, { cooldown });
        }

        const autologinToken = await (async (autologin) => {
            if (!autologin) return;
            // Our autologin token next needed is hidden away in some
            // form which is autosubmitted, so we need to read that out
            const html = removeBreaks(await login.text());
            const tokenMatch = html.match(patterns.EMBEDDED_TOKEN);
            if (tokenMatch === null) return;
            // We need to use the second index because the first would be the whole string
            // including the <input> stuff we put in the non-capturing group
            // Example: [ "<input value="1234567890abcdef">", "1234567890abcdef" ]
            const token = tokenMatch[1];
            if (!token || !patterns.SESSION_OR_AUTOLOGIN.test(token)) return;

            const registerBrowser = await fetch("https://login.schulportal.hessen.de/registerbrowser", {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Cookie: `SPH-Session=${session}`,
                    ...generateDefaultHeaders(address)
                },
                method: "POST",
                body: [`token=${token}`, `fg=WeNeedToFillThese32CharactersMan`].join("&"),
                redirect: "manual"
            });

            const cookies = parseCookies(registerBrowser.headers.getSetCookie());
            const cookie = cookies["SPH-AutoLogin"];

            if (registerBrowser.status !== 302 || !cookie) return;

            return cookie;
        })(autologin);

        const connect = await fetch("https://connect.schulportal.hessen.de", {
            method: "HEAD",
            redirect: "manual",
            headers: {
                Cookie: `SPH-Session=${session}`,
                ...generateDefaultHeaders(address)
            }
        });

        const location = connect.headers.get("location");
        if (!location || !location.startsWith("https://start.schulportal.hessen.de/schulportallogin.php?k") || connect.status !== 302)
            return setErrorResponseEvent(event, 401);

        const spLogin = await fetch(location, {
            method: "HEAD",
            redirect: "manual",
            headers: generateDefaultHeaders(address)
        });

        if (!spLogin.headers.getSetCookie().length) return setErrorResponseEvent(event, 503);

        return {
            error: false,
            token: parseCookies(spLogin.headers.getSetCookie()).sid,
            session: session,
            autologin: autologinToken
        };
    } catch (error) {
        console.error(error);
        return setErrorResponseEvent(event, 500);
    }
});

/**
 * If for some reason, most likely when the servers are under heavy load,
 * the login using login.schulportal.hessen.de does not succeed, the old
 * (SPH1) system is still in place. It functions quite differently:
 * - first obtain a sid (as cookie) and ikey (in form) by GETting start.schulportal.hessen.de/?i=<school>&oldLogin=1
 * - then obtain an AES key and link it with the server (like in the decryption endpoint), however now with
 *   that useless sid cookie generated when GETting the first site
 * - we can then encrypt our credentials using that AES key
 *   -> this most likely only exists due to HTTPS not being standard back then and transmitting
 *      sensitive data over the network w/o encryption could have been dangerous
 * - this now only gives us another sid cookie (our good old token)
 * NOTE: There is an option for staying logged in, this however is weirdly implemented and
 * I can't be bothered to reverse that system
 */
async function attemptLegacyLogin(event: H3Event, username: string, password: string, school: number, address?: string) {
    const loginPage = await fetch(`https://start.schulportal.hessen.de/index.php?i=${school}&oldLogin=1`);
    const { sid } = parseCookies(loginPage.headers.getSetCookie());
    const text = removeBreaks(await loginPage.text());
    const ikeyMatch = text.match(/(?:<input type="hidden" name="ikey" value=")([0-9a-f]{32})(?:">)/i);
    // That would mean that the old SPH1 service is shut down for that school or globally
    if (ikeyMatch === null || !sid) return setErrorResponseEvent(event, 503);
    const ikey = ikeyMatch[1];

    const key = cryptoJS.AES.encrypt(generateUUID(), generateUUID()).toString();
    const encrypted = publicEncrypt(
        {
            key: SPH_PUBLIC_KEY,
            padding: constants.RSA_PKCS1_PADDING
        },
        Buffer.from(key)
    );

    const handshake = await fetch(`https://start.schulportal.hessen.de/ajax.php?f=rsaHandshake&s=${Math.floor(Math.random() * 2000)}`, {
        method: "POST",
        body: `key=${encodeURIComponent(encrypted.toString("base64"))}`,
        headers: {
            Cookie: `i=${school}; sid=${sid}`,
            "Content-Type": "application/x-www-form-urlencoded",
            ...generateDefaultHeaders(address)
        }
    });

    const json = await handshake.json();
    if (!json.challenge) return setErrorResponseEvent(event, 500);

    const decryptedWordArray = cryptoJS.AES.decrypt(json.challenge, key);
    const decryptedB64 = Buffer.from(decryptedWordArray.toString(), "hex").toString();
    if (decryptedB64 !== key) return setErrorResponseEvent(event, 401, "Keys do not match");

    const encryptedCredentials = cryptoJS.AES.encrypt(
        `f=alllogin&art=all&sid=&ikey=${ikey}&user=${username}&passw=${encodeURIComponent(password)}`,
        key
    ).toString();

    const login = await fetch(`https://start.schulportal.hessen.de/ajax.php`, {
        method: "POST",
        body: `crypt=${encodeURIComponent(encryptedCredentials)}`,
        headers: {
            Cookie: `i=${school}; sid=${sid}`,
            "Content-Type": "application/x-www-form-urlencoded",
            ...generateDefaultHeaders(address)
        }
    });

    const { sid: actualSid } = parseCookies(login.headers.getSetCookie());
    if (!actualSid) return setErrorResponseEvent(event, 401);
    return {
        error: false,
        token: actualSid
    };
}
