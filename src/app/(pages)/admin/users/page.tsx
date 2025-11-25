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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";

interface CustomRole {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  customRoleId: string | null;
  customRole: CustomRole | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    role: string;
    name: string | null;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tenantDomain, setTenantDomain] = useState("");
  const [username, setUsername] = useState("");
  const [formData, setFormData] = useState({
    password: "",
    name: "",
    role: "user",
    customRoleId: "",
    requirePasswordChange: false,
    requireMfaSetup: false,
  });

  useEffect(() => {
    checkAuth();
    fetchUsers();
    fetchCustomRoles();
    fetchTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load users");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomRoles = async () => {
    try {
      const response = await fetch("/api/admin/roles");
      if (!response.ok) {
        throw new Error("Failed to fetch roles");
      }
      const data = await response.json();
      setCustomRoles(data.filter((r: { isActive: boolean }) => r.isActive));
    } catch (error) {
      console.error("Failed to load custom roles:", error);
    }
  };

  const fetchTenant = async () => {
    try {
      const response = await fetch("/api/admin/tenants");
      const data = await response.json();
      if (data && data.length > 0) {
        setTenantDomain(data[0].domain);
      }
    } catch (error) {
      console.error("Failed to load tenant:", error);
    }
  };

  const handleUsernameChange = (value: string) => {
    // Remove @ and domain if user pastes full email
    let cleanValue = value.replace(`@${tenantDomain}`, "");
    // Remove any @ symbols
    cleanValue = cleanValue.replace(/@/g, "");
    setUsername(cleanValue);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username) {
      toast.error("Please enter a username");
      return;
    }

    // Construct full email with domain
    const fullEmail = `${username}@${tenantDomain}`;

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          email: fullEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to create user");
        return;
      }

      toast.success("User created successfully");
      setIsCreateDialogOpen(false);
      setUsername("");
      setFormData({
        password: "",
        name: "",
        role: "user",
        customRoleId: "",
        requirePasswordChange: false,
        requireMfaSetup: false,
      });
      fetchUsers();
    } catch (error) {
      toast.error("An error occurred while creating user");
      console.error(error);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update user role");
        return;
      }

      toast.success("User role updated successfully");
      fetchUsers();
    } catch (error) {
      toast.error("An error occurred while updating user");
      console.error(error);
    }
  };

  const openEditDialog = (user: User) => {
    setUserToEdit(user);
    setEditName(user.name || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateName = async () => {
    if (!userToEdit) return;

    try {
      const response = await fetch(`/api/admin/users/${userToEdit.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: editName || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update user name");
        return;
      }

      toast.success("User name updated successfully");
      setIsEditDialogOpen(false);
      setUserToEdit(null);
      setEditName("");
      fetchUsers();
    } catch (error) {
      toast.error("An error occurred while updating user");
      console.error(error);
    }
  };

  const handleUpdateCustomRole = async (
    userId: string,
    customRoleId: string | null,
  ) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customRoleId }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update custom role");
        return;
      }

      toast.success("Custom role updated successfully");
      fetchUsers();
    } catch (error) {
      toast.error("An error occurred while updating custom role");
      console.error(error);
    }
  };

  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to delete user");
        return;
      }

      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      toast.error("An error occurred while deleting user");
      console.error(error);
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

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      user.customRole?.name.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

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
                  variant="default"
                  onClick={() => router.push("/admin/users")}
                >
                  Users
                </Button>
                <Button
                  variant="ghost"
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
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage users and their roles in your tenant
                </CardDescription>
              </div>
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>Add User</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new user to your tenant
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
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
                          @{tenantDomain || "loading..."}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Email will be:{" "}
                        <span className="font-medium">
                          {username || "(username)"}@
                          {tenantDomain || "loading..."}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="flex gap-2">
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              password: e.target.value,
                            })
                          }
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const chars =
                              "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$!%*?&";
                            const length = 16;
                            let password = "";
                            // Ensure at least one of each required character type
                            password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[
                              Math.floor(Math.random() * 26)
                            ];
                            password += "abcdefghijklmnopqrstuvwxyz"[
                              Math.floor(Math.random() * 26)
                            ];
                            password += "0123456789"[
                              Math.floor(Math.random() * 10)
                            ];
                            password += "@$!%*?&"[
                              Math.floor(Math.random() * 7)
                            ];
                            // Fill the rest randomly
                            for (let i = password.length; i < length; i++) {
                              password +=
                                chars[Math.floor(Math.random() * chars.length)];
                            }
                            // Shuffle the password
                            password = password
                              .split("")
                              .sort(() => Math.random() - 0.5)
                              .join("");
                            setFormData({ ...formData, password });
                            toast.success("Password generated");
                          }}
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">System Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) =>
                          setFormData({ ...formData, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customRole">Custom Role (Optional)</Label>
                      <Select
                        value={formData.customRoleId || "__none__"}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            customRoleId: value === "__none__" ? "" : value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select custom role (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {customRoles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requirePasswordChange"
                        checked={formData.requirePasswordChange}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            requirePasswordChange: checked === true,
                          })
                        }
                      />
                      <Label
                        htmlFor="requirePasswordChange"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Require password change on first login
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requireMfaSetup"
                        checked={formData.requireMfaSetup}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            requireMfaSetup: checked === true,
                          })
                        }
                      />
                      <Label
                        htmlFor="requireMfaSetup"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Require two-factor authentication setup
                      </Label>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Create User</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Edit User Name Dialog */}
              <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit User Name</DialogTitle>
                    <DialogDescription>
                      Update the display name for {userToEdit?.email}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="editName">Name</Label>
                      <Input
                        id="editName"
                        placeholder="John Doe"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Leave empty to remove the name
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditDialogOpen(false);
                        setUserToEdit(null);
                        setEditName("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleUpdateName}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Confirmation Dialog */}
              <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      Delete User
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="pt-4 space-y-3">
                        <div className="text-base">
                          Are you sure you want to delete this user? This action
                          cannot be undone.
                        </div>
                        {userToDelete && (
                          <div className="bg-muted p-4 rounded-lg space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm font-medium text-muted-foreground">
                                Name:
                              </span>
                              <span className="text-sm font-semibold">
                                {userToDelete.name || "—"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium text-muted-foreground">
                                Email:
                              </span>
                              <span className="text-sm font-semibold">
                                {userToDelete.email}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium text-muted-foreground">
                                Role:
                              </span>
                              <Badge
                                variant={
                                  userToDelete.role === "admin"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {userToDelete.role}
                              </Badge>
                            </div>
                          </div>
                        )}
                        <div className="text-sm text-destructive font-medium">
                          ⚠️ All user data, sessions, and permissions will be
                          permanently deleted.
                        </div>
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDeleteDialogOpen(false);
                        setUserToDelete(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteUser}
                    >
                      Delete User
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search users by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Custom Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No users found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name || "—"}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value) =>
                            handleUpdateRole(user.id, value)
                          }
                          disabled={user.id === currentUser?.id}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.customRoleId || "__none__"}
                          onValueChange={(value) =>
                            handleUpdateCustomRole(
                              user.id,
                              value === "__none__" ? null : value,
                            )
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="No custom role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {customRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isActive ? "default" : "secondary"}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            disabled={user.id === currentUser?.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
