"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";
import Image from "next/image";

type LoginStep = "login" | "passwordChange" | "mfaSetup" | "mfa";

interface MfaSetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [step, setStep] = useState<LoginStep>("login");
  const [userId, setUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupData | null>(null);
  const [mfaSetupCode, setMfaSetupCode] = useState("");

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch("/api/setup/check");
        const data = await response.json();
        if (data.setupRequired) {
          router.push("/setup");
        }
      } catch (error) {
        console.error("Setup check failed:", error);
      } finally {
        setIsCheckingSetup(false);
      }
    };
    checkSetup();
  }, [router]);

  const handleEmailChange = (email: string) => {
    setFormData({ ...formData, email });
    
    // Extract and display domain
    const emailParts = email.split("@");
    if (emailParts.length === 2 && emailParts[1]) {
      setDetectedDomain(emailParts[1]);
    } else {
      setDetectedDomain(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Extract tenant domain from email
    const emailParts = formData.email.split("@");
    if (emailParts.length !== 2) {
      toast.error("Please enter a valid email address");
      setIsLoading(false);
      return;
    }
    const tenantDomain = emailParts[1];

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          tenantDomain,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Login failed");
        return;
      }

      // Check if password change is required
      if (data.requirePasswordChange) {
        setUserId(data.userId);
        setStep("passwordChange");
        toast.info("You must change your password before continuing");
        return;
      }

      // Check if MFA setup is required
      if (data.requireMfaSetup) {
        toast.info("Your administrator requires you to set up two-factor authentication");
        router.push("/settings");
        return;
      }

      // Check if MFA is required
      if (data.requireMfa) {
        setUserId(data.userId);
        setStep("mfa");
        return;
      }

      // Successful login
      toast.success("Login successful!");
      
      // Redirect based on role
      if (data.role === "admin") {
        router.push("/admin/users");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (error) {
      toast.error("An error occurred during login");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (formData.password === newPassword) {
      toast.error("New password must be different from current password");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      setIsLoading(false);
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(newPassword)) {
      toast.error("Password must contain uppercase, lowercase, number, and symbol (@$!%*?&)");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          currentPassword: formData.password,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully!");

      // Check if MFA setup is required
      if (data.requireMfaSetup) {
        toast.info("Your administrator requires you to set up two-factor authentication");
        // Start MFA setup flow
        await handleStartMfaSetup();
        return;
      }

      // Check if MFA is required
      if (data.requireMfa) {
        setStep("mfa");
        return;
      }

      // Redirect based on role
      if (data.user.role === "admin") {
        router.push("/admin/users");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (error) {
      toast.error("An error occurred while changing password");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/mfa/verify-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          code: mfaCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Invalid verification code");
        return;
      }

      toast.success("Login successful!");

      // Redirect based on role
      if (data.user.role === "admin") {
        router.push("/admin/users");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (error) {
      toast.error("An error occurred during verification");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMfaSetup = async () => {
    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to start MFA setup");
        return;
      }

      setMfaSetupData(data);
      setStep("mfaSetup");
    } catch (error) {
      toast.error("An error occurred while starting MFA setup");
      console.error(error);
    }
  };

  const handleCompleteMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!mfaSetupCode || mfaSetupCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: mfaSetupCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Invalid verification code");
        setIsLoading(false);
        return;
      }

      toast.success("Two-factor authentication enabled successfully!");

      // Redirect based on role
      if (data.user.role === "admin") {
        router.push("/admin/users");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (error) {
      toast.error("An error occurred while verifying MFA setup");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSetup) {
    return null; // Or a loading spinner if you prefer
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
          {step === "login" && (
          <>
            <CardHeader>
              <CardTitle>Welcome Back</CardTitle>
              <CardDescription>Sign in to your PrismAuth account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    required
                  />
                  {detectedDomain && (
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Logging in to tenant: <span className="font-semibold">{detectedDomain}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => router.push("/forgot-password")}
                >
                  Forgot Password?
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === "passwordChange" && (
          <>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                You must change your password before continuing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Must be 8+ characters with uppercase, lowercase, number, and symbol (@$!%*?&)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Changing Password..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === "mfaSetup" && mfaSetupData && (
          <>
            <CardHeader>
              <CardTitle>Set Up Two-Factor Authentication</CardTitle>
              <CardDescription>
                Your administrator requires you to set up 2FA to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompleteMfaSetup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Step 1: Scan QR Code</Label>
                  <p className="text-sm text-muted-foreground">
                    Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code:
                  </p>
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <Image
                      src={mfaSetupData.qrCode}
                      alt="MFA QR Code"
                      width={200}
                      height={200}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Or manually enter this secret: <code className="bg-muted px-2 py-1 rounded">{mfaSetupData.secret}</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Step 2: Save Backup Codes</Label>
                  <p className="text-sm text-muted-foreground">
                    Save these backup codes in a secure location. You can use them to access your account if you lose your device.
                  </p>
                  <div className="bg-muted p-3 rounded-lg space-y-1">
                    {mfaSetupData.backupCodes.map((code, index) => (
                      <div key={index} className="text-sm font-mono">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mfaSetupCode">Step 3: Enter Verification Code</Label>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code from your authenticator app to verify the setup:
                  </p>
                  <Input
                    id="mfaSetupCode"
                    type="text"
                    placeholder="000000"
                    value={mfaSetupCode}
                    onChange={(e) => setMfaSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Complete Setup"}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === "mfa" && (
          <>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Enter the 6-digit code from your authenticator app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMfaVerification} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">Verification Code</Label>
                  <Input
                    id="mfaCode"
                    type="text"
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Or use one of your backup codes
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify"}
                </Button>
              </form>
            </CardContent>
          </>
        )}
        </Card>
      </motion.div>
    </div>
  );
}
