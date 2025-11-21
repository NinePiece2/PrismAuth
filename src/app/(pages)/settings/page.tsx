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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Shield, Download, Lock } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  mfaEnabled: boolean;
}

interface MfaSetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();

      if (!data.authenticated) {
        router.push("/login");
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error("Auth check failed:", error);
      router.push("/login");
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
      setShowMfaSetup(true);
    } catch (error) {
      toast.error("An error occurred while starting MFA setup");
      console.error(error);
    }
  };

  const handleVerifyAndEnableMfa = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Invalid verification code");
        return;
      }

      toast.success("Two-factor authentication enabled!");
      setShowMfaSetup(false);
      setVerificationCode("");
      setMfaSetupData(null);

      // Refresh user data
      checkAuth();
    } catch (error) {
      toast.error("An error occurred while enabling MFA");
      console.error(error);
    }
  };

  const handleDisableMfa = async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: disableCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Invalid verification code");
        return;
      }

      toast.success("Two-factor authentication disabled");
      setShowMfaDisable(false);
      setDisableCode("");

      // Refresh user data
      checkAuth();
    } catch (error) {
      toast.error("An error occurred while disabling MFA");
      console.error(error);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(newPassword)) {
      toast.error(
        "Password must contain uppercase, lowercase, number, and symbol (@$!%*?&)",
      );
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully");
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("An error occurred while changing password");
      console.error(error);
    }
  };

  const downloadBackupCodes = () => {
    if (!mfaSetupData?.backupCodes) return;

    const content = `PrismAuth Backup Codes\n\nEmail: ${user?.email}\nGenerated: ${new Date().toLocaleString()}\n\n${mfaSetupData.backupCodes.join("\n")}\n\nKeep these codes safe! Each code can only be used once.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prismauth-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Backup codes downloaded");
  };

  if (isLoading) {
    return (
      <motion.div
        className="min-h-screen flex items-center justify-center bg-background"
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

  return (
    <div className="min-h-screen bg-background p-8">
      <motion.div
        className="absolute top-4 right-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ThemeToggle />
      </motion.div>
      <motion.div
        className="max-w-4xl mx-auto space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your account settings and security
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              try {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/");
                }
              } catch {
                router.push("/");
              }
            }}
          >
            Back
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email</Label>
                <p className="text-sm mt-1">{user?.email}</p>
              </div>
              <div>
                <Label>Name</Label>
                <p className="text-sm mt-1">{user?.name || "—"}</p>
              </div>
              <div>
                <Label>Role</Label>
                <Badge
                  className="mt-1"
                  variant={user?.role === "admin" ? "default" : "secondary"}
                >
                  {user?.role}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password
              </CardTitle>
              <CardDescription>
                Change your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowChangePassword(true)}>
                Change Password
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Two-Factor Authentication
                  </CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account
                  </CardDescription>
                </div>
                {user?.mfaEnabled ? (
                  <Badge variant="default" className="ml-4">
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-4">
                    Disabled
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {user?.mfaEnabled ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Two-factor authentication is currently enabled on your
                    account. You&apos;ll need to enter a code from your
                    authenticator app when signing in.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowMfaDisable(true)}
                  >
                    Disable Two-Factor Authentication
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Two-factor authentication adds an extra layer of security to
                    your account. You&apos;ll need to enter a code from your
                    authenticator app when signing in.
                  </p>
                  <Button onClick={handleStartMfaSetup}>
                    Enable Two-Factor Authentication
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* MFA Setup Dialog */}
      <Dialog open={showMfaSetup} onOpenChange={setShowMfaSetup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Follow these steps to enable 2FA on your account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. Scan this QR code</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Use your authenticator app (Google Authenticator, Authy, etc.)
                to scan this code:
              </p>
              {mfaSetupData?.qrCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <Image
                    src={mfaSetupData.qrCode}
                    alt="QR Code"
                    width={200}
                    height={200}
                  />
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2">Or enter this code manually:</h4>
              <code className="block p-2 bg-secondary text-sm rounded break-all">
                {mfaSetupData?.secret}
              </code>
            </div>

            <div>
              <h4 className="font-medium mb-2">2. Save your backup codes</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Save these backup codes in a safe place. You can use them to
                access your account if you lose your authenticator device.
              </p>
              <div className="bg-secondary p-3 rounded space-y-1 max-h-32 overflow-y-auto">
                {mfaSetupData?.backupCodes.map((code, i) => (
                  <code key={i} className="block text-sm">
                    {code}
                  </code>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={downloadBackupCodes}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Backup Codes
              </Button>
            </div>

            <div>
              <h4 className="font-medium mb-2">3. Enter verification code</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Enter the 6-digit code from your authenticator app:
              </p>
              <Input
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMfaSetup(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerifyAndEnableMfa}>Enable 2FA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MFA Disable Dialog */}
      <Dialog open={showMfaDisable} onOpenChange={setShowMfaDisable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter a verification code from your authenticator app to confirm
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="disableCode">Verification Code</Label>
              <Input
                id="disableCode"
                type="text"
                placeholder="000000"
                value={disableCode}
                onChange={(e) =>
                  setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMfaDisable(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisableMfa}>
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, with A-Z, a-z, 0-9, symbol"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Must include uppercase, lowercase, number, and symbol (@$!%*?&)
              </p>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowChangePassword(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePassword}>Change Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
