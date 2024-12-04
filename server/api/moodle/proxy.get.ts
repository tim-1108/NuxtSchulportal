import { generateDefaultHeaders, patterns, setErrorResponseEvent, STATIC_STRINGS } from "../../utils";
import { generateMoodleURL, lookupSchoolMoodle } from "../../moodle";
import { SchemaEntryConsumer, validateQueryNew } from "~/server/validator";
import { getRequestAddress } from "~/server/ratelimit";

const querySchema: SchemaEntryConsumer = {
    cookie: { required: true, pattern: patterns.MOODLE_COOKIE },
    school: { required: true, type: "number", min: 1, max: 9999 },
    path: {
        required: true,
        min: 1,
        max: 512,
        pattern: /^\/(theme\/image\.php\/sph\/core\/\d{1,20}\/)|(pluginfile.php\/\d{1,10}\/.{1,100}).{1,50}$/,
        validator_function(key, schema, value: string) {
            return /\.\./gi.test(value);
        }
    }
};

export default defineEventHandler(async (event) => {
    const query = getQuery<Record<string, string>>(event);
    const queryValidation = validateQueryNew(querySchema, query);
    if (queryValidation.violations > 0) return setErrorResponseEvent(event, 400, queryValidation);

    const address = getRequestAddress(event);

    const { cookie, school, path } = query;

    try {
        const hasMoodle = await lookupSchoolMoodle(school);
        if (!hasMoodle) return setErrorResponseEvent(event, 404, STATIC_STRINGS.MOODLE_SCHOOL_NOT_EXIST);

        const response = await fetch(`${generateMoodleURL(school)}${path}`, {
            method: "GET",
            headers: {
                Cookie: `MoodleSession=${cookie}`,
                ...generateDefaultHeaders(address)
            }
        });

        event.node.res.setHeader("Content-Type", response.headers.get("Content-Type") || "image/png");
        return await response.blob();
    } catch (error) {
        console.error(error);
        return setErrorResponseEvent(event, 500);
    }
});
