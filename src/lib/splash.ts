import { cookies } from "next/headers";

/** Cookie de vida curta que avisa "acabou de entrar": o layout da área mostra a tela do patinho uma vez. */
const SPLASH_COOKIE = "qp_splash"; // o mesmo nome é apagado em components/DuckSplash.tsx

export function markSplash() {
  cookies().set(SPLASH_COOKIE, "1", { path: "/", maxAge: 30, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

export function splashPending() {
  return cookies().get(SPLASH_COOKIE)?.value === "1";
}
