import { RateLimitAcceptance, handleRateLimit } from "../ratelimit";
import { patterns, setErrorResponse, transformEndpointSchema, validateBody } from "../utils";

const schema = {
    body: {
        endpoint: { required: true, type: "string", pattern: patterns.NOTIFICATION_ENDPOINT },
        auth: { required: true, type: "string", pattern: patterns.NOTIFICATION_AUTH },
        p256dh: { required: true, type: "string", pattern: patterns.NOTIFICATION_P256DH },
        autologin: { required: true, type: "string", pattern: patterns.SESSION_OR_AUTOLOGIN }
    }
};

export default defineEventHandler(async (event) => {
    const { req, res } = event.node;
    const address = req.headersDistinct["x-forwarded-for"]?.join("; ");

    if (req.headers["content-type"] !== "application/json") return setErrorResponse(res, 400, "Expected 'application/json' as 'content-type' header");

    const body = await readBody<{ endpoint: string; auth: string; p256dh: string; autologin: string }>(event);
    if (!validateBody(body, schema.body)) return setErrorResponse(res, 400, transformEndpointSchema(schema));

    const rateLimit = handleRateLimit("/api/notifications.post", address);
    if (rateLimit !== RateLimitAcceptance.Allowed) return setErrorResponse(res, rateLimit === RateLimitAcceptance.Rejected ? 429 : 403);

    const config = useRuntimeConfig();

    try {
        const { url, key } = config.private.notificationApi;
        if (!(url || key)) return setErrorResponse(res, 503);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: key,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        if (response.status !== 200) return setErrorResponse(res, response.status);
        return { error: false };
    } catch (error) {
        console.error(error);
        return setErrorResponse(res, 500);
    }
});
