"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useProtectPage } from "@/hooks/use-protect-page";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

export default function ProfilePage() {
  useProtectPage();
  const { data, isLoading, mutate } = useSWR("/api/me", fetcher);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setName((data.name as string) || "");
      setEmail((data.email as string) || "");
    }
  }, [data]);

  async function handleSave() {
    // Basic validations
    if (!email) {
      toast.error("Email is required");
      return;
    }
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password: password || undefined,
          confirmPassword: confirmPassword || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.message || "Failed to update profile");
        return;
      }
      toast.success("Profile updated");
      setPassword("");
      setConfirmPassword("");
      mutate();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-full">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>
            Update your personal information and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password (optional)"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
