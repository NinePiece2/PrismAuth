"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [tenantDomain, setTenantDomain] = useState("");
  const [username, setUsername] = useState("");
  const [formData, setFormData] = useState({
    password: "",
    name: "",
  });

  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Check if user is already logged in
        const authResponse = await fetch("/api/auth/me");
        if (authResponse.ok) {
          // User is already authenticated, redirect to home
          router.push("/");
          return;
        }

        // Check if setup is required
        const response = await fetch("/api/setup/check");
        const data = await response.json();
        if (data.setupRequired) {
          router.push("/setup");
          return;
        }

        // Fetch tenant info - for now we'll get the first tenant
        // In a multi-tenant setup, you'd select the tenant differently
        const tenantsResponse = await fetch("/api/admin/tenants");
        const tenantsData = await tenantsResponse.json();
        if (tenantsData.tenants && tenantsData.tenants.length > 0) {
          setTenantDomain(tenantsData.tenants[0].domain);
        }
      } catch (error) {
        console.error("Setup check failed:", error);
      } finally {
        setIsCheckingSetup(false);
      }
    };
    checkSetup();
  }, [router]);

  const handleUsernameChange = (value: string) => {
    // Remove @ and domain if user pastes full email
    let cleanValue = value.replace(`@${tenantDomain}`, "");
    // Remove any @ symbols
    cleanValue = cleanValue.replace(/@/g, "");
    setUsername(cleanValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!username) {
      toast.error("Please enter a username");
      setIsLoading(false);
      return;
    }

    // Construct full email with domain
    const fullEmail = `${username}@${tenantDomain}`;

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: fullEmail,
          password: formData.password,
          name: formData.name,
          tenantDomain,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }

      toast.success("Registration successful!");
      router.push("/");
    } catch (error) {
      toast.error("An error occurred during registration");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSetup) {
    return null;
  }

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
            <CardTitle>Create an Account</CardTitle>
            <CardDescription>
              Register to get started with PrismAuth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="john"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    required
                    className="pr-32"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
                    @{tenantDomain}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your email will be:{" "}
                  <span className="font-medium">
                    {username}@{tenantDomain}
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Min 8 characters with uppercase, lowercase, number, and symbol
                  (@$!%*?&)
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Register"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{" "}
              <Button
                variant="link"
                className="p-0"
                onClick={() => router.push("/login")}
              >
                Sign in
              </Button>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
