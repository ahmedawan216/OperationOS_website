export const ACCESS_TOKEN_COOKIE = "operationos-access-token";
export const REFRESH_TOKEN_COOKIE = "operationos-refresh-token";

const SESSION_MAX_AGE = 60 * 60 * 24 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export function setSessionCookies(
  store: { set: (name: string, value: string, options: typeof sessionCookieOptions) => void },
  accessToken: string,
  refreshToken: string
) {
  store.set(ACCESS_TOKEN_COOKIE, accessToken, sessionCookieOptions);
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, sessionCookieOptions);
}

export function clearSessionCookies(
  store: { set: (name: string, value: string, options: typeof sessionCookieOptions) => void }
) {
  const options = { ...sessionCookieOptions, maxAge: 0 };
  store.set(ACCESS_TOKEN_COOKIE, "", options);
  store.set(REFRESH_TOKEN_COOKIE, "", options);
}
