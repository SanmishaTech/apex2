"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, User as UserIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string | null; size?: number }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <div
      className="relative inline-flex items-center justify-center overflow-hidden rounded-full border bg-gradient-to-br from-muted/70 to-muted text-xs font-medium text-foreground/80"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name || "User"}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

export function UserNav() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // control dropdown visibility
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const displayName = user?.name || (user?.email ? user.email.split("@")[0] : "User");

  async function handleLogout() {
    try {
      setLoadingLogout(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
  } catch {
      // silent for now
    } finally {
      setLoadingLogout(false);
    }
  }

  return (
    <>
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="group relative h-9 px-2 pr-3 overflow-hidden"
        >
          <Avatar src={user?.profilePhoto} name={user?.name} size={28} />
          <span className="hidden md:inline-block max-w-[140px] truncate font-semibold text-xs group-hover:text-foreground/90">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar src={user?.profilePhoto} name={user?.name} size={40} />
          <div className="flex flex-col gap-0 min-w-0">
            <span className="text-sm font-semibold leading-tight truncate">
              {displayName}
            </span>
            <span className="text-xs font-normal text-muted-foreground leading-tight truncate">
              {user?.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            router.push("/profile");
          }}
        >
          <UserIcon className="size-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={loadingLogout}
          onSelect={(e) => {
            e.preventDefault();
            setMenuOpen(false);
            setLogoutDialogOpen(true);
          }}
        >
          <LogOut className="size-4 text-muted-foreground" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
  </DropdownMenu>
  <ConfirmDialog
      open={logoutDialogOpen}
      onOpenChange={(o) => setLogoutDialogOpen(o)}
      title="Logout"
      description="Are you sure you want to end this session?"
      confirmText={loadingLogout ? "Logging out..." : "Logout"}
      onConfirm={handleLogout}
      disabled={loadingLogout}
    />
  </>
  );
}
