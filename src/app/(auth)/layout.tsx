import { ThemeToggle } from "@/components/layout/theme-toggle";
import Image from "next/image";
import { Building2 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "My App";
  const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || "Please sign in to your account and start the adventure";

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 xl:min-h-screen bg-gradient-to-b from-background via-background/70 to-background">
      <div className="hidden bg-muted lg:block relative">
        <Image
          src="/login-cover.jpg"
          alt="Login Cover"
          className="z-0 blur-sm object-cover"
          fill
        />
        <div className="absolute inset-0 bg-black/60 z-0" />
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="p-8 text-white max-w-md">
            <div className="flex items-center gap-3 text-4xl font-bold">
              <Building2 className="w-12 h-12" />
              <h1 className="text-white">{appName}</h1>
            </div>
            <blockquote className="mt-6 border-l-4 pl-4">
              <p className="text-2xl">“{appDescription}”</p>
            </blockquote>
          </div>
        </div>
      </div>
      <div className="relative flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        {/* Mobile brand header (hidden on large screens) */}
        <div className="mb-8 w-full max-w-md lg:hidden space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {appName} <span className="align-middle">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground">{appDescription}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
