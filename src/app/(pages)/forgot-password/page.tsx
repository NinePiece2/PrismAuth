"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Extract tenant domain from email
      const domain = email.split("@")[1];

      if (!domain) {
        toast.error("Please enter a valid email address");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          tenantDomain: domain,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If rate limited, extract cooldown time and set it
        if (response.status === 429 && data.error) {
          const match = data.error.match(/(\d+) seconds/);
          if (match) {
            setCooldown(parseInt(match[1]));
          }
        }
        toast.error(data.error || "Failed to send reset email");
        setIsLoading(false);
        return;
      }

      setEmailSent(true);
      setCooldown(30);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We&apos;ve sent password reset instructions to{" "}
              <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              If an account exists with this email, you&apos;ll receive a
              password reset link shortly. The link will expire in 1 hour.
            </p>
            {cooldown > 0 && (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - cooldown / 30)}`}
                      className="text-primary transition-all duration-1000 ease-linear"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {cooldown}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Please wait before sending another email
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Button
                onClick={() => router.push("/login")}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
              <Button
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
                variant="ghost"
                className="w-full"
                disabled={cooldown > 0}
              >
                {cooldown > 0 ? `Wait ${cooldown}s` : "Send Another Email"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset
            your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                We&apos;ll use your email domain to identify your organization
              </p>
            </div>
            {cooldown > 0 && (
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - cooldown / 30)}`}
                      className="text-primary transition-all duration-1000 ease-linear"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {cooldown}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Please wait before sending another email
                </p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || cooldown > 0}
            >
              {isLoading
                ? "Sending..."
                : cooldown > 0
                  ? `Wait ${cooldown}s`
                  : "Send Reset Link"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/login")}
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
