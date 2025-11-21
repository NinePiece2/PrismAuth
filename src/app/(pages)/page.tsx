"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";

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
      <motion.div 
        className="min-h-screen flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading...
        </motion.p>
      </motion.div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div 
          className="absolute top-4 right-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ThemeToggle />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card>
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
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      className="min-h-screen bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <motion.div 
              className="flex items-center"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h1 className="text-xl font-bold">PrismAuth</h1>
            </motion.div>
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
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
            </motion.div>
          </div>
        </div>
      </nav>
      <motion.div 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
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
      </motion.div>
    </motion.div>
  );
}
