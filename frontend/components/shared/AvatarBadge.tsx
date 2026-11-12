"use client";

import React from "react";

interface AvatarBadgeProps {
  name: string;
  department?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: "ACTIVE" | "ON_LEAVE" | "TERMINATED" | "PRESENT" | "HALF_DAY" | "ABSENT";
  showStatus?: boolean;
  className?: string;
}

export function AvatarBadge({
  name,
  department = "Engineering",
  size = "md",
  status,
  showStatus = false,
  className = "",
}: AvatarBadgeProps) {
  const getInitials = (n: string) => {
    if (!n) return "DF";
    const parts = n.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const getGradient = (dept: string) => {
    switch (dept?.toLowerCase()) {
      case "management":
        return "from-amber-500 via-rose-500 to-purple-600 text-white";
      case "human resources":
      case "hr":
        return "from-purple-500 via-pink-500 to-indigo-600 text-white";
      case "engineering":
        return "from-cyan-500 via-blue-600 to-indigo-600 text-white";
      case "product":
        return "from-blue-500 via-cyan-500 to-teal-500 text-white";
      case "sales":
        return "from-emerald-500 via-teal-500 to-cyan-600 text-white";
      case "marketing":
        return "from-amber-500 via-orange-500 to-rose-500 text-white";
      case "finance":
        return "from-indigo-500 via-purple-600 to-blue-700 text-white";
      default:
        return "from-cyan-500 to-blue-600 text-white";
    }
  };

  const sizeClasses = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
  };

  const statusColor = () => {
    switch (status) {
      case "ACTIVE":
      case "PRESENT":
        return "bg-emerald-400";
      case "ON_LEAVE":
        return "bg-purple-400";
      case "HALF_DAY":
        return "bg-[#ff6b3d]";
      case "TERMINATED":
      case "ABSENT":
        return "bg-rose-400";
      default:
        return "bg-emerald-400";
    }
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-tr ${getGradient(
          department
        )} font-heading font-extrabold flex items-center justify-center shadow-md tracking-wider select-none border border-white/20`}
      >
        {getInitials(name)}
      </div>

      {showStatus && status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${
            size === "xl" ? "w-4 h-4 border-2" : size === "lg" ? "w-3.5 h-3.5 border-2" : "w-2.5 h-2.5 border"
          } rounded-full ${statusColor()} border-slate-950 shadow-sm`}
        />
      )}
    </div>
  );
}
