import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: { params: { scope: 'identify email' } },
      profile(profile) {
        let imageUrl = "";
        if (profile.avatar) {
          const format = profile.avatar.startsWith("a_") ? "gif" : "png";
          imageUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}?size=512`;
        } else {
          // 기본 아바타 처리
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
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.image = user.image;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.image = token.image;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
