/**
 * Prints a fresh AUTH_SECRET. Equivalent to `openssl rand -base64 32`, which
 * is not installed everywhere on Windows.
 *
 *   npm run gen:secret
 */
import { randomBytes } from "node:crypto";

console.log(randomBytes(32).toString("base64"));
