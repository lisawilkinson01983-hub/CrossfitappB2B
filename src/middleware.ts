import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that also require a logged-in Box 2 Box user, once past the site
// password gate below (unchanged from the previous next-auth middleware).
const AUTH_REQUIRED_PREFIXES = ["/feed", "/discover", "/profile", "/workouts", "/messages", "/settings"];

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Box 2 Box (test site)"' },
  });
}

// Gates the whole test deployment behind one shared password, separate from
// each athlete's own login — only active when SITE_PASSWORD is set (e.g. in
// Railway), so local dev is never affected. The username is ignored; only
// the password is checked.
function checkSitePassword(req: NextRequest): NextResponse | null {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) return null;

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized();

  try {
    const decoded = atob(auth.slice("Basic ".length));
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (password !== sitePassword) return unauthorized();
  } catch {
    return unauthorized();
  }

  return null;
}

export async function middleware(req: NextRequest) {
  const gateResponse = checkSitePassword(req);
  if (gateResponse) return gateResponse;

  const needsUserAuth = AUTH_REQUIRED_PREFIXES.some((prefix) => req.nextUrl.pathname.startsWith(prefix));
  if (needsUserAuth) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const signInUrl = new URL("/login", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
