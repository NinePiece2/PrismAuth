export const config = {
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  oauth2: {
    issuer:
      process.env.OAUTH2_ISSUER ||
      process.env.BASE_URL ||
      "http://localhost:3000",
    accessTokenExpiry: parseInt(process.env.ACCESS_TOKEN_EXPIRY || "3600", 10),
    refreshTokenExpiry: parseInt(
      process.env.REFRESH_TOKEN_EXPIRY || "2592000",
      10,
    ),
    authorizationCodeExpiry: parseInt(
      process.env.AUTHORIZATION_CODE_EXPIRY || "600",
      10,
    ),
  },
  session: {
    secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
    cookieName: "prismauth_session",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  jwt: {
    privateKey: process.env.JWT_PRIVATE_KEY,
    publicKey: process.env.JWT_PUBLIC_KEY,
  },
};
