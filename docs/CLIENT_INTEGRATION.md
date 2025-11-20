# Integrating Your Application with PrismAuth

This guide shows how to integrate your application with PrismAuth for OAuth2/OIDC authentication.

## Overview

PrismAuth provides OAuth 2.0 Authorization Code flow with PKCE for secure authentication. Your app will:

1. Redirect users to PrismAuth for login
2. Receive an authorization code
3. Exchange the code for access tokens
4. Use tokens to access user information

## Example Integration (Node.js/Express)

### 1. Install Dependencies

```bash
npm install axios pkce-challenge
```

### 2. Configuration

```javascript
// config.js
const config = {
  prismauth: {
    issuer: "http://localhost:3000",
    clientId: "client_your_client_id",
    clientSecret: "your_client_secret",
    redirectUri: "http://localhost:3001/callback",
    scopes: ["openid", "profile", "email"],
  },
};

module.exports = config;
```

### 3. Generate PKCE Challenge

```javascript
// auth.js
const { generateChallenge } = require("pkce-challenge");

function startLogin() {
  // Generate PKCE challenge
  const pkce = generateChallenge();

  // Store code_verifier in session (you'll need it later)
  session.codeVerifier = pkce.code_verifier;

  // Build authorization URL
  const authUrl = new URL(`${config.prismauth.issuer}/api/oauth/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.prismauth.clientId);
  authUrl.searchParams.set("redirect_uri", config.prismauth.redirectUri);
  authUrl.searchParams.set("scope", config.prismauth.scopes.join(" "));
  authUrl.searchParams.set("code_challenge", pkce.code_challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", generateRandomState()); // Prevent CSRF

  // Redirect user to PrismAuth
  return authUrl.toString();
}
```

### 4. Handle Callback

```javascript
// routes/callback.js
const axios = require("axios");

app.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  // Check for errors
  if (error) {
    return res.status(400).send(`Authentication error: ${error}`);
  }

  // Verify state (CSRF protection)
  if (state !== session.state) {
    return res.status(400).send("Invalid state parameter");
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      `${config.prismauth.issuer}/api/oauth/token`,
      {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: config.prismauth.redirectUri,
        client_id: config.prismauth.clientId,
        client_secret: config.prismauth.clientSecret,
        code_verifier: session.codeVerifier, // PKCE verifier
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    const { access_token, refresh_token, id_token, expires_in } =
      tokenResponse.data;

    // Store tokens in session
    session.accessToken = access_token;
    session.refreshToken = refresh_token;
    session.idToken = id_token;

    // Redirect to app
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Token exchange failed:", error.response?.data);
    res.status(500).send("Authentication failed");
  }
});
```

### 5. Get User Information

```javascript
// Get user profile
async function getUserInfo(accessToken) {
  try {
    const response = await axios.get(
      `${config.prismauth.issuer}/api/oauth/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data;
    // {
    //   sub: 'user_id',
    //   email: 'user@example.com',
    //   email_verified: true,
    //   name: 'John Doe',
    //   tenant_id: 'tenant_id'
    // }
  } catch (error) {
    console.error("Failed to get user info:", error.response?.data);
    throw error;
  }
}
```

### 6. Refresh Access Token

```javascript
async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post(
      `${config.prismauth.issuer}/api/oauth/token`,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.prismauth.clientId,
        client_secret: config.prismauth.clientSecret,
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    return response.data;
    // {
    //   access_token: 'new_access_token',
    //   token_type: 'Bearer',
    //   expires_in: 3600,
    //   scope: 'openid profile email'
    // }
  } catch (error) {
    console.error("Token refresh failed:", error.response?.data);
    throw error;
  }
}
```

### 7. Protect Routes

```javascript
// middleware/auth.js
async function requireAuth(req, res, next) {
  const accessToken = req.session.accessToken;

  if (!accessToken) {
    return res.redirect("/login");
  }

  try {
    // Verify token is still valid by getting user info
    const userInfo = await getUserInfo(accessToken);
    req.user = userInfo;
    next();
  } catch (error) {
    // Token expired or invalid
    if (req.session.refreshToken) {
      try {
        // Try to refresh
        const tokens = await refreshAccessToken(req.session.refreshToken);
        req.session.accessToken = tokens.access_token;

        // Retry with new token
        const userInfo = await getUserInfo(tokens.access_token);
        req.user = userInfo;
        next();
      } catch (refreshError) {
        // Refresh failed, need to re-login
        return res.redirect("/login");
      }
    } else {
      return res.redirect("/login");
    }
  }
}

// Use in routes
app.get("/dashboard", requireAuth, (req, res) => {
  res.render("dashboard", { user: req.user });
});
```

### 8. Logout

```javascript
app.get("/logout", (req, res) => {
  // Clear local session
  req.session.destroy();

  // Optionally redirect to PrismAuth logout
  // (if you implement a logout endpoint)
  res.redirect("/");
});
```

## Complete Express Example

```javascript
// app.js
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const { generateChallenge } = require("pkce-challenge");
const crypto = require("crypto");

const app = express();
const config = require("./config");

// Session middleware
app.use(
  session({
    secret: "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set true in production with HTTPS
  }),
);

// Login route
app.get("/login", (req, res) => {
  const pkce = generateChallenge();
  const state = crypto.randomBytes(16).toString("hex");

  req.session.codeVerifier = pkce.code_verifier;
  req.session.state = state;

  const authUrl = new URL(`${config.prismauth.issuer}/api/oauth/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.prismauth.clientId);
  authUrl.searchParams.set("redirect_uri", config.prismauth.redirectUri);
  authUrl.searchParams.set("scope", config.prismauth.scopes.join(" "));
  authUrl.searchParams.set("code_challenge", pkce.code_challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  res.redirect(authUrl.toString());
});

// Callback route
app.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`Error: ${error}`);
  }

  if (state !== req.session.state) {
    return res.status(400).send("Invalid state");
  }

  try {
    const tokenResponse = await axios.post(
      `${config.prismauth.issuer}/api/oauth/token`,
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: config.prismauth.redirectUri,
        client_id: config.prismauth.clientId,
        client_secret: config.prismauth.clientSecret,
        code_verifier: req.session.codeVerifier,
      },
    );

    req.session.accessToken = tokenResponse.data.access_token;
    req.session.refreshToken = tokenResponse.data.refresh_token;

    res.redirect("/dashboard");
  } catch (error) {
    console.error("Auth error:", error.response?.data);
    res.status(500).send("Authentication failed");
  }
});

// Protected route
app.get("/dashboard", async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect("/login");
  }

  try {
    const userResponse = await axios.get(
      `${config.prismauth.issuer}/api/oauth/userinfo`,
      {
        headers: { Authorization: `Bearer ${req.session.accessToken}` },
      },
    );

    res.send(`
      <h1>Dashboard</h1>
      <p>Welcome, ${userResponse.data.name || userResponse.data.email}!</p>
      <pre>${JSON.stringify(userResponse.data, null, 2)}</pre>
      <a href="/logout">Logout</a>
    `);
  } catch (error) {
    req.session.destroy();
    res.redirect("/login");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Home
app.get("/", (req, res) => {
  res.send('<h1>My App</h1><a href="/login">Login with PrismAuth</a>');
});

app.listen(3001, () => {
  console.log("App running on http://localhost:3001");
});
```

## Frontend (React) Example

```javascript
// useAuth.js
import { useState, useEffect } from "react";
import axios from "axios";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await axios.get("/api/me");
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function login() {
    window.location.href = "/login";
  }

  function logout() {
    window.location.href = "/logout";
  }

  return { user, loading, login, logout };
}

// App.js
function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div>
        <h1>Welcome</h1>
        <button onClick={login}>Login with PrismAuth</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.name}!</p>
      <p>Email: {user.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Testing Your Integration

1. **Start PrismAuth**:

   ```bash
   cd PrismAuth
   bun run dev
   ```

2. **Create an OAuth Client** (use the admin API):

   ```bash
   curl -X POST http://localhost:3000/api/admin/clients \
     -H "Content-Type: application/json" \
     -b cookies.txt \
     -d '{
       "name": "My App",
       "redirectUris": ["http://localhost:3001/callback"],
       "allowedScopes": ["openid", "profile", "email"],
       "grantTypes": ["authorization_code", "refresh_token"]
     }'
   ```

3. **Update your app config** with the client credentials

4. **Start your app**:

   ```bash
   node app.js
   ```

5. **Test the flow**:
   - Visit http://localhost:3001
   - Click "Login"
   - Authenticate at PrismAuth
   - Approve consent
   - Get redirected back with user info

## Security Best Practices

1. **Always use PKCE** - Protects against authorization code interception
2. **Validate state parameter** - Prevents CSRF attacks
3. **Store tokens securely** - Use HTTP-only cookies or secure session storage
4. **Use HTTPS in production** - Never send tokens over unencrypted connections
5. **Implement token refresh** - Handle expired access tokens gracefully
6. **Validate redirect URIs** - Ensure they match registered URIs
7. **Handle errors properly** - Don't expose sensitive error details to users

## Troubleshooting

**"Invalid redirect_uri"**

- Ensure the redirect URI exactly matches what's registered in PrismAuth
- Include protocol, host, port, and path

**"Invalid client"**

- Check client_id and client_secret are correct
- Verify the client is active in PrismAuth

**"Invalid PKCE code_verifier"**

- Ensure you're using the same code_verifier that generated the code_challenge
- Verify it's being stored and retrieved correctly from session

**Token expired**

- Implement token refresh logic
- Check token expiry times and refresh before expiration

## Next Steps

- Implement logout flow
- Add error handling and retry logic
- Set up token refresh automation
- Add loading states and user feedback
- Implement role-based access control
- Add multi-tenant support in your app

## Resources

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [PrismAuth Documentation](../README.md)
