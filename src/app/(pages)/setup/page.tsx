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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type SetupStep = 1 | 2;

export default function SetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState<SetupStep>(1);

  const [tenantName, setTenantName] = useState("");
  const [tenantDomain, setTenantDomain] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check");
        const data = await response.json();

        if (!data.setupRequired) {
          // Setup already completed, redirect to login
          router.push("/login");
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        console.error("Error checking setup status:", error);
        setIsChecking(false);
      }
    };

    checkSetupStatus();
  }, [router]);
  const validateStep1 = (): boolean => {
    if (!tenantName || !tenantDomain) {
      toast.error("Please fill in all tenant information");
      return false;
    }

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(tenantDomain)) {
      toast.error("Please enter a valid domain (e.g., example.com)");
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleAdminUsernameChange = (value: string) => {
    // Remove @ and domain if user pastes full email
    let cleanValue = value.replace(`@${tenantDomain}`, "");
    // Remove any @ symbols
    cleanValue = cleanValue.replace(/@/g, "");
    setAdminUsername(cleanValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!adminUsername || !adminPassword) {
      toast.error("All fields are required");
      return;
    }

    if (adminPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (adminPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Construct full email with domain
    const adminEmail = `${adminUsername}@${tenantDomain}`;

    setIsLoading(true);

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantName,
          tenantDomain,
          adminName: adminName || null,
          adminEmail,
          adminPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to complete setup");
        setIsLoading(false);
        return;
      }

      setSetupComplete(true);
      toast.success("Setup completed successfully!");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Checking setup status...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Setup Complete!</CardTitle>
            <CardDescription>
              Your PrismAuth instance has been successfully configured
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Redirecting to login page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 1 ? "bg-purple-600 text-white" : "bg-green-600 text-white"}`}
              >
                1
              </div>
              <div
                className={`h-1 w-12 ${currentStep === 2 ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"}`}
              />
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 2 ? "bg-purple-600 text-white" : "bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}
              >
                2
              </div>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentStep} of 2
            </span>
          </div>
          <CardTitle className="text-2xl">
            {currentStep === 1
              ? "Welcome to PrismAuth"
              : "Create Admin Account"}
          </CardTitle>
          <CardDescription>
            {currentStep === 1
              ? "Let's start by setting up your organization"
              : `Create an administrator account for ${tenantName}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 1 ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantName">Organization Name *</Label>
                  <Input
                    id="tenantName"
                    placeholder="My Company"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    The name of your organization or application
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenantDomain">Domain *</Label>
                  <Input
                    id="tenantDomain"
                    placeholder="mycompany.com"
                    value={tenantDomain}
                    onChange={(e) =>
                      setTenantDomain(e.target.value.toLowerCase())
                    }
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    A unique domain identifier (e.g., example.com). This will be
                    used for user emails.
                  </p>
                </div>
              </div>

              <Button onClick={handleNext} className="w-full" size="lg">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <p className="text-sm text-purple-900 dark:text-purple-100">
                    <strong>Domain:</strong> @{tenantDomain}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    All user accounts will use this domain
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminName">Admin Name (Optional)</Label>
                  <Input
                    id="adminName"
                    placeholder="John Doe"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminUsername">Admin Username *</Label>
                  <div className="relative">
                    <Input
                      id="adminUsername"
                      type="text"
                      placeholder="admin"
                      value={adminUsername}
                      onChange={(e) =>
                        handleAdminUsernameChange(e.target.value)
                      }
                      required
                      disabled={isLoading}
                      className="pr-32"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
                      @{tenantDomain}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Admin email will be:{" "}
                    <span className="font-medium">
                      {adminUsername}@{tenantDomain}
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Admin Password *</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="Enter a secure password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Must be at least 8 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1"
                  disabled={isLoading}
                  size="lg"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isLoading}
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
