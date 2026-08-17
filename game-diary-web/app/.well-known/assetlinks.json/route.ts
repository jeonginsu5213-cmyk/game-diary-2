import { NextResponse } from "next/server";

const androidAppLinkStatements = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.insu.plog",
      // EAS development build signing certificate. Add the Play App Signing
      // certificate here before publishing through Google Play.
      sha256_cert_fingerprints: [
        "8A:C9:27:BA:44:84:48:A0:57:96:8C:9A:48:0D:7E:8F:15:A8:FF:63:83:59:76:1F:70:B9:D8:B7:58:11:59:91",
      ],
    },
  },
];

export async function GET() {
  return NextResponse.json(androidAppLinkStatements, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
