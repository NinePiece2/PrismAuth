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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";

interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret?: string;
  name: string;
  description: string | null;
  redirectUris: string[];
  allowedScopes: string[];
  grantTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<OAuthClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<OAuthClient | null>(null);
  const [createdClient, setCreatedClient] = useState<OAuthClient | null>(null);
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [regeneratedSecret, setRegeneratedSecret] = useState<string | null>(
    null,
  );
  const [showRegeneratedSecretDialog, setShowRegeneratedSecretDialog] =
    useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    role: string;
    name: string | null;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    redirectUris: "",
    allowedScopes: "openid,profile,email",
    grantTypes: "authorization_code,refresh_token",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    redirectUris: "",
    allowedScopes: "",
  });

  useEffect(() => {
    const initPage = async () => {
      await checkAuth();
      await fetchApplications();
    };
    initPage();
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

  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/admin/clients");
      if (!response.ok) {
        throw new Error("Failed to fetch applications");
      }
      const data = await response.json();
      setApplications(data);
    } catch (error) {
      toast.error("Failed to load applications");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    const redirectUrisArray = formData.redirectUris
      .split(",")
      .map((uri) => uri.trim())
      .filter((uri) => uri.length > 0);

    const allowedScopesArray = formData.allowedScopes
      .split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);

    const grantTypesArray = formData.grantTypes
      .split(",")
      .map((type) => type.trim())
      .filter((type) => type.length > 0);

    if (redirectUrisArray.length === 0) {
      toast.error("At least one redirect URI is required");
      return;
    }

    try {
      const response = await fetch("/api/admin/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          redirectUris: redirectUrisArray,
          allowedScopes: allowedScopesArray,
          grantTypes: grantTypesArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to create application");
        return;
      }

      setCreatedClient(data);
      setShowSecretDialog(true);
      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        redirectUris: "",
        allowedScopes: "openid,profile,email",
        grantTypes: "authorization_code,refresh_token",
      });
      fetchApplications();
    } catch (error) {
      toast.error("An error occurred while creating application");
      console.error(error);
    }
  };

  const openEditDialog = (app: OAuthClient) => {
    setEditingClient(app);
    setEditFormData({
      name: app.name,
      description: app.description || "",
      redirectUris: app.redirectUris.join("\n"),
      allowedScopes: app.allowedScopes.join(","),
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingClient) return;

    try {
      const response = await fetch(`/api/admin/clients/${editingClient.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editFormData.name,
          description: editFormData.description || null,
          redirectUris: editFormData.redirectUris
            .split("\n")
            .filter((uri) => uri.trim()),
          allowedScopes: editFormData.allowedScopes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update application");
        return;
      }

      toast.success("Application updated successfully");
      setIsEditDialogOpen(false);
      setEditingClient(null);
      fetchApplications();
    } catch (error) {
      toast.error("An error occurred while updating application");
      console.error(error);
    }
  };

  const handleRegenerateSecret = async (app: OAuthClient) => {
    if (
      !confirm(
        "Are you sure you want to regenerate the client secret? The old secret will no longer work.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/clients/${app.id}/regenerate-secret`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to regenerate secret");
        return;
      }

      setRegeneratedSecret(data.clientSecret);
      setShowRegeneratedSecretDialog(true);
      toast.success("Client secret regenerated successfully");
    } catch (error) {
      toast.error("An error occurred while regenerating secret");
      console.error(error);
    }
  };

  const handleDeleteApplication = async (clientId: string) => {
    if (!confirm("Are you sure you want to delete this application?")) {
      return;
    }

    try {
      const app = applications.find((a) => a.clientId === clientId);
      if (!app) return;

      const response = await fetch(`/api/admin/clients/${app.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to delete application");
        return;
      }

      toast.success("Application deleted successfully");
      fetchApplications();
    } catch (error) {
      toast.error("An error occurred while deleting application");
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

  const filteredApplications = applications.filter((app) => {
    const query = searchQuery.toLowerCase();
    return (
      app.name.toLowerCase().includes(query) ||
      app.clientId.toLowerCase().includes(query) ||
      app.description?.toLowerCase().includes(query) ||
      app.redirectUris.some((uri) => uri.toLowerCase().includes(query))
    );
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

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
                  variant="ghost"
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
                  variant="default"
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
                <CardTitle>OAuth2 Applications</CardTitle>
                <CardDescription>
                  Manage OAuth2 applications and their allowed redirect URLs
                </CardDescription>
              </div>
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>Add Application</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create OAuth2 Application</DialogTitle>
                    <DialogDescription>
                      Register a new OAuth2 application with redirect URLs
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={handleCreateApplication}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="name">Application Name</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="My Application"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        type="text"
                        placeholder="A brief description of your application"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="redirectUris">
                        Redirect URIs (comma-separated)
                      </Label>
                      <Input
                        id="redirectUris"
                        type="text"
                        placeholder="https://app.example.com/callback, https://app.example.com/auth/callback"
                        value={formData.redirectUris}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            redirectUris: e.target.value,
                          })
                        }
                        required
                      />
                      <p className="text-sm text-gray-500">
                        These are the allowed URLs where users will be
                        redirected after authentication
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allowedScopes">
                        Allowed Scopes (comma-separated)
                      </Label>
                      <Input
                        id="allowedScopes"
                        type="text"
                        placeholder="openid, profile, email"
                        value={formData.allowedScopes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            allowedScopes: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grantTypes">
                        Grant Types (comma-separated)
                      </Label>
                      <Input
                        id="grantTypes"
                        type="text"
                        placeholder="authorization_code, refresh_token"
                        value={formData.grantTypes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            grantTypes: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Create Application</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search applications by name, client ID, description, or redirect URI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Redirect URIs</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-gray-500"
                    >
                      No applications found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{app.name}</div>
                          {app.description && (
                            <div className="text-sm text-gray-500">
                              {app.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {app.clientId}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {app.redirectUris.map((uri, index) => (
                            <div key={index} className="truncate max-w-xs">
                              {uri}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {app.allowedScopes.slice(0, 3).map((scope, index) => (
                            <Badge key={index} variant="secondary">
                              {scope}
                            </Badge>
                          ))}
                          {app.allowedScopes.length > 3 && (
                            <Badge variant="secondary">
                              +{app.allowedScopes.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={app.isActive ? "default" : "secondary"}>
                          {app.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(app)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRegenerateSecret(app)}
                          >
                            Regenerate Secret
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleDeleteApplication(app.clientId)
                            }
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

        {/* Edit Application Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Application</DialogTitle>
              <DialogDescription>
                Update application details. Changes take effect immediately.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateApplication} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">
                  Application Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  type="text"
                  placeholder="My Application"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  type="text"
                  placeholder="Optional description"
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-redirectUris">
                  Redirect URIs (one per line){" "}
                  <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="edit-redirectUris"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  placeholder="https://example.com/callback&#10;https://example.com/auth/callback"
                  value={editFormData.redirectUris}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      redirectUris: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-allowedScopes">
                  Allowed Scopes (comma-separated){" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-allowedScopes"
                  type="text"
                  placeholder="openid, profile, email"
                  value={editFormData.allowedScopes}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      allowedScopes: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingClient(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Regenerated Secret Dialog */}
        <Dialog
          open={showRegeneratedSecretDialog}
          onOpenChange={setShowRegeneratedSecretDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Client Secret Generated</DialogTitle>
              <DialogDescription>
                Save this secret securely. It will not be shown again.
              </DialogDescription>
            </DialogHeader>
            {regeneratedSecret && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>New Client Secret</Label>
                  <div className="flex gap-2">
                    <Input value={regeneratedSecret} readOnly type="password" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => copyToClipboard(regeneratedSecret)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400">
                  ⚠️ Make sure to copy and save the new client secret now. The
                  old secret is no longer valid!
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={() => {
                  setShowRegeneratedSecretDialog(false);
                  setRegeneratedSecret(null);
                }}
              >
                I have saved the secret
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Client Secret Dialog */}
        <Dialog open={showSecretDialog} onOpenChange={setShowSecretDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Application Created Successfully</DialogTitle>
              <DialogDescription>
                Save these credentials securely. The client secret will not be
                shown again.
              </DialogDescription>
            </DialogHeader>
            {createdClient && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <div className="flex gap-2">
                    <Input value={createdClient.clientId} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => copyToClipboard(createdClient.clientId)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <div className="flex gap-2">
                    <Input
                      value={createdClient.clientSecret || ""}
                      readOnly
                      type="password"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(createdClient.clientSecret || "")
                      }
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400">
                  ⚠️ Make sure to copy and save the client secret now. You will
                  not be able to see it again!
                </p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowSecretDialog(false)}>
                I have saved the credentials
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
