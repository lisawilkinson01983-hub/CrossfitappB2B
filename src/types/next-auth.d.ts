import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      // The Account actually signed in — stable across /settings/profiles
      // switches even onto a profile owned by a different Account (see
      // ProfileAccess). Account-level actions (change email/password,
      // delete account, list/add profiles) must key off this, never off
      // whichever profile happens to be active.
      accountId: string;
    } & DefaultSession["user"];
  }

  interface User {
    accountId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    accountId: string;
  }
}
