"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();

      if (data.authenticated) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to PrismAuth</CardTitle>
            <CardDescription>
              Multi-tenant OAuth2 authentication server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please sign in to continue.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => router.push("/login")} className="flex-1">
                Sign In
              </Button>
              {/* Self-registration disabled - users must be created by admins
              <Button
                onClick={() => router.push("/register")}
                variant="outline"
                className="flex-1"
              >
                Register
              </Button>
              */}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">PrismAuth</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {user.name || user.email}
              </span>
              {user.role === "admin" && (
                <Button
                  variant="outline"
                  onClick={() => router.push("/admin/users")}
                >
                  Admin Panel
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push("/settings")}
              >
                Settings
              </Button>
              <ThemeToggle />
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Welcome back, {user.name || user.email}!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                <strong>Role:</strong> {user.role}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You are successfully authenticated with PrismAuth.
              </p>
            </div>
            {user.role === "admin" && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Admin Actions</h3>
                <div className="flex gap-4">
                  <Button onClick={() => router.push("/admin/users")}>
                    Manage Users
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/admin/applications")}
                  >
                    Manage Applications
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
