"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  className?: string;
  variant?: "ghost" | "secondary" | "outline" | "primary";
  size?: "sm" | "md" | "lg";
}

export function LogoutButton({
  className,
  variant = "ghost",
  size = "sm",
}: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      isLoading={isLoading}
      onClick={handleLogout}
      className={className}
    >
      <LogOut className="w-3.5 h-3.5 mr-1.5" />
      <span>Sign out</span>
    </Button>
  );
}
