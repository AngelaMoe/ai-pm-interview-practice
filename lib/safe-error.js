// lib/safe-error.js
// Maps errors to safe client messages. The real error is logged server-side
// and never sent to the client.

export class HttpError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export const badRequest = (message) => new HttpError(400, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const progressUnavailable = () =>
  new HttpError(503, "Progress can't be saved right now. You can keep going, but it may not save.");

const GENERIC_MESSAGE = 'Something went wrong, please try again.';

export function safeError(res, err, context = 'request') {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.publicMessage });
  }
  console.error(`Error in ${context}:`, err);
  return res.status(500).json({ error: GENERIC_MESSAGE });
}
