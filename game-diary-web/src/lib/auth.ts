import crypto from "crypto";
import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { supabaseService } from "@/src/lib/supabase";

function getSupabaseSignature(userId: string) {
  const secret = process.env.NEXTAUTH_SECRET || "default_local_secret_key_for_dev";
  return crypto.createHmac("sha256", secret).update(userId).digest("hex");
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: { params: { scope: "identify email" } },
      profile(profile) {
        let imageUrl = "";

        if (profile.avatar) {
          const format = profile.avatar.startsWith("a_") ? "gif" : "png";
          imageUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}?size=512`;
        } else {
          const defaultAvatarNumber = (BigInt(profile.id) >> BigInt(22)) % BigInt(6);
          imageUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        }

        return {
          id: profile.id,
          name: profile.global_name || profile.username,
          email: profile.email,
          image: imageUrl,
          username: profile.username,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      if (user?.id) {
        try {
          await supabaseService.from("profiles").upsert({
            id: user.id,
            display_name: user.name,
            avatar_url: user.image,
            has_logged_in: true,
            updated_at: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Failed to update profile login status in Supabase:", error);
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const customToken = token as typeof token & {
          id?: string;
          username?: string;
          signature?: string;
        };
        const customUser = user as typeof user & { username?: string };

        customToken.id = user.id;
        customToken.username = customUser.username;
        customToken.image = user.image;
        customToken.signature = getSupabaseSignature(user.id);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const customToken = token as typeof token & {
          id?: string;
          username?: string;
          signature?: string;
        };
        const customSessionUser = session.user as typeof session.user & {
          id?: string;
          username?: string;
          signature?: string;
        };

        customSessionUser.id = customToken.id;
        customSessionUser.username = customToken.username;
        customSessionUser.image = typeof token.image === "string" ? token.image : undefined;
        customSessionUser.signature = customToken.signature;
      }

      return session;
    },
  },
};
