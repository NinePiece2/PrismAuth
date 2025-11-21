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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface Application {
  id: string;
  name: string;
  clientId: string;
}

interface RolePermission {
  id: string;
  permissions: string[];
  application: Application;
  createdAt: string;
}

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: RolePermission[];
  _count: {
    users: number;
  };
}

const COMMON_PERMISSIONS = [
  "read",
  "write",
  "delete",
  "admin",
  "create",
  "update",
  "manage",
  "view",
];

export default function RolePermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState<string>("");
  const [role, setRole] = useState<CustomRole | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    role: string;
    name: string | null;
  } | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [customPermission, setCustomPermission] = useState("");

  useEffect(() => {
    params.then((p) => setRoleId(p.id));
  }, [params]);

  useEffect(() => {
    if (roleId) {
      checkAuth();
      fetchRole();
      fetchApplications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();

      if (!data.authenticated || data.user.role !== "admin") {
        router.push("/login");
        return;
      }

      setCurrentUser(data.user);
    } catch (error) {
      console.error("Auth check failed:", error);
      router.push("/login");
    }
  };

  const fetchRole = async () => {
    try {
      const response = await fetch(`/api/admin/roles/${roleId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch role");
      }
      const data = await response.json();
      setRole(data);
    } catch (error) {
      toast.error("Failed to load role");
      console.error(error);
      router.push("/admin/roles");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/admin/clients");
      if (!response.ok) {
        throw new Error("Failed to fetch applications");
      }
      const data = await response.json();
      setApplications(data);
    } catch (error) {
      console.error("Failed to load applications:", error);
    }
  };

  const handleAddPermission = async () => {
    if (!selectedAppId || selectedPermissions.length === 0) {
      toast.error("Please select an application and at least one permission");
      return;
    }

    try {
      const response = await fetch(`/api/admin/roles/${roleId}/permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId: selectedAppId,
          permissions: selectedPermissions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to set permissions");
        return;
      }

      toast.success("Permissions updated successfully");
      setIsAddDialogOpen(false);
      setSelectedAppId("");
      setSelectedPermissions([]);
      setCustomPermission("");
      fetchRole();
    } catch (error) {
      toast.error("An error occurred while setting permissions");
      console.error(error);
    }
  };

  const handleDeletePermission = async (permissionId: string) => {
    if (!confirm("Are you sure you want to remove these permissions?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/roles/${roleId}/permissions/${permissionId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to delete permissions");
        return;
      }

      toast.success("Permissions removed successfully");
      fetchRole();
    } catch (error) {
      toast.error("An error occurred while removing permissions");
      console.error(error);
    }
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission],
    );
  };

  const addCustomPermission = () => {
    if (customPermission && !selectedPermissions.includes(customPermission)) {
      setSelectedPermissions((prev) => [...prev, customPermission]);
      setCustomPermission("");
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    );
  }

  if (!role) {
    return null;
  }

  const availableApps = applications.filter(
    (app) => !role.permissions.some((p) => p.application.id === app.id),
  );

  return (
    <div className="min-h-screen bg-background">
      <motion.nav
        className="bg-card border-b border-border"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold">PrismAuth Admin</h1>
              <div className="flex space-x-4">
                <Button variant="ghost" onClick={() => router.push("/")}>
                  Home
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/admin/users")}
                >
                  Users
                </Button>
                <Button
                  variant="default"
                  onClick={() => router.push("/admin/roles")}
                >
                  Roles
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/admin/applications")}
                >
                  Applications
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentUser?.name || currentUser?.email}
              </span>
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
      </motion.nav>

      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/roles")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Roles
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{role.name}</CardTitle>
            <CardDescription>
              {role.description || "No description"}
              {" • "}
              <Badge variant="secondary" className="ml-2">
                {role._count.users} users
              </Badge>
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Application Permissions</CardTitle>
                <CardDescription>
                  Manage what this role can do in each application
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                disabled={availableApps.length === 0}
              >
                Add Permissions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {role.permissions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">
                  No permissions configured yet. Add permissions to get started!
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {role.permissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-medium">
                        {permission.application.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {permission.application.clientId}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {permission.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary">
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleDeletePermission(permission.application.id)
                          }
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Permission Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Application Permissions</DialogTitle>
              <DialogDescription>
                Select an application and the permissions this role should have
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="application">Application</Label>
                <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an application" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableApps.map((app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Common Permissions</Label>
                <div className="grid grid-cols-2 gap-3">
                  {COMMON_PERMISSIONS.map((permission) => (
                    <div
                      key={permission}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={permission}
                        checked={selectedPermissions.includes(permission)}
                        onCheckedChange={() => togglePermission(permission)}
                      />
                      <Label
                        htmlFor={permission}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {permission}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customPermission">Custom Permission</Label>
                <div className="flex gap-2">
                  <Input
                    id="customPermission"
                    placeholder="Enter custom permission..."
                    value={customPermission}
                    onChange={(e) => setCustomPermission(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomPermission();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomPermission}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {selectedPermissions.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Permissions</Label>
                  <div className="flex flex-wrap gap-2 p-3 bg-secondary rounded-md">
                    {selectedPermissions.map((perm) => (
                      <Badge
                        key={perm}
                        variant="default"
                        className="cursor-pointer"
                        onClick={() => togglePermission(perm)}
                      >
                        {perm} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setSelectedAppId("");
                  setSelectedPermissions([]);
                  setCustomPermission("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddPermission}>Save Permissions</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
