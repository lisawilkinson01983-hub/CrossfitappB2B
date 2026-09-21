export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/feed/:path*",
    "/discover/:path*",
    "/profile/:path*",
    "/workouts/:path*",
    "/messages/:path*",
  ],
};
