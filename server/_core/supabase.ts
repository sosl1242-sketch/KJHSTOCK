import { createClient, type SupabaseClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

let serverSupabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    return null;
  }

  if (!serverSupabase) {
    serverSupabase = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey || ENV.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serverSupabase;
}

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function getDisplayName(user: SupabaseUser) {
  const metadata = user.user_metadata ?? {};
  const name = metadata.name ?? metadata.full_name ?? metadata.display_name;
  return typeof name === "string" && name.trim().length > 0 ? name : null;
}

export async function authenticateSupabaseRequest(req: Request): Promise<User> {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error("Missing Supabase bearer token");
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error(error?.message ?? "Invalid Supabase session");
  }

  const supabaseUser = data.user;
  const email = supabaseUser.email ?? null;

  await db.upsertUser({
    openId: supabaseUser.id,
    email,
    name: getDisplayName(supabaseUser),
    loginMethod: "email",
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(supabaseUser.id);
  if (!user) {
    throw new Error("Failed to load local user profile");
  }

  return user;
}

