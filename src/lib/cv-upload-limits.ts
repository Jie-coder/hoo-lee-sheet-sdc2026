// Shared between the client (so it can reject a bad file before uploading)
// and POST /api/parse-cv (the authoritative check): one limit, defined once.
export const MAX_CV_BYTES = 2 * 1024 * 1024; // 2 MB
export const CV_MIME_TYPE = "application/pdf";
