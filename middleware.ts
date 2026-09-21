export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/feed/:path*", "/profile/:path*", "/workouts/:path*"],
};
