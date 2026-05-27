import { createClient, type SupabaseClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

let serverSupabase: SupabaseClient | null = null;
let adminSupabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    return null;
  }

  if (!serverSupabase) {
    serverSupabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serverSupabase;
}

function getSupabaseAdminClient() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
    return null;
  }

  if (!adminSupabase) {
    adminSupabase = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminSupabase;
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

export async function createConfirmedEmailUser(input: { email: string; password: string }) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin signup is not configured");
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create Supabase user");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? input.email,
  };
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
