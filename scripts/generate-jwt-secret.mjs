import { randomBytes } from "crypto";

function gen(len = 64) {
  return randomBytes(len).toString("base64url"); // url-safe, no padding
}

console.log("JWT_ACCESS_SECRET =", gen(64));
console.log("JWT_REFRESH_SECRET =", gen(64));
