"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

interface ClientInfo {
  name: string;
  description?: string;
}

export default function ConsentPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);

  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const scope = searchParams.get("scope") || "";
  const state = searchParams.get("state");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");
  const responseType = searchParams.get("response_type");
  const nonce = searchParams.get("nonce");

  const scopes = scope.split(" ").filter(Boolean);

  const scopeDescriptions: Record<string, string> = {
    openid: "Verify your identity",
    profile: "Access your basic profile information (name, picture)",
    email: "Access your email address",
    offline_access: "Access your data while you're offline",
  };

  useEffect(() => {
    // Fetch client information
    const fetchClientInfo = async () => {
      if (!clientId) return;

      try {
        const response = await fetch(`/api/admin/clients`);
        if (response.ok) {
          const clients = await response.json();
          const client = clients.find(
            (c: { clientId: string; name: string; description?: string }) =>
              c.clientId === clientId
          );
          if (client) {
            setClientInfo({
              name: client.name,
              description: client.description,
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch client info:", error);
      }
    };

    fetchClientInfo();
  }, [clientId]);

  const handleConsent = async (approved: boolean) => {
    if (!clientId || !redirectUri) {
      toast.error("Missing required parameters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          response_type: responseType,
          nonce,
          approved,
        }),
      });

      const data = await response.json();

      if (response.ok && data.redirect_uri) {
        // Redirect back to the client application
        // Using window.location for external redirects (client app)
        if (typeof window !== "undefined") {
          window.location.replace(data.redirect_uri);
        }
      } else {
        toast.error(data.error_description || "Consent failed");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Consent error:", error);
      toast.error("An error occurred during consent");
      setIsLoading(false);
    }
  };

  if (!clientId || !redirectUri) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Request</CardTitle>
            <CardDescription>
              Missing required OAuth2 parameters
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Authorize Application
          </CardTitle>
          <CardDescription>
            {clientInfo ? (
              <>
                <span className="font-semibold">{clientInfo.name}</span> is
                requesting access to your account
              </>
            ) : (
              <>
                <span className="font-semibold">{clientId}</span> is requesting
                access to your account
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {clientInfo?.description && (
            <div className="text-sm text-muted-foreground">
              {clientInfo.description}
            </div>
          )}

          <div className="space-y-3">
            <div className="text-sm font-medium">
              This application will be able to:
            </div>
            <div className="space-y-2">
              {scopes.map((scopeItem) => (
                <div
                  key={scopeItem}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="mt-0.5">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">{scopeItem}</div>
                    <div className="text-muted-foreground">
                      {scopeDescriptions[scopeItem] ||
                        `Access ${scopeItem} data`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            By authorizing, you allow this application to use your information
            in accordance with their terms of service and privacy policy.
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleConsent(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Deny
            </Button>
            <Button
              onClick={() => handleConsent(true)}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Authorizing..." : "Authorize"}
            </Button>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            Redirect URI:{" "}
            <span className="font-mono break-all">{redirectUri}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
