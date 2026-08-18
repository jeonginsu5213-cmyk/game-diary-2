import { NextResponse } from "next/server";

const appIdentifier = "7G4RX9SNPW.com.insu.plog";

export function GET() {
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [appIdentifier],
            components: [{ "/": "/mobile/auth/callback" }],
          },
        ],
      },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
