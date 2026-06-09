"use client";

import {
  LayoutDashboard,
  DollarSign,
  BarChart3,
  Factory,
  Truck,
  ArrowUpDown,
  TrendingUp,
  Upload,
  AlertTriangle,
  Siren,
  Users,
  Boxes,
  LogOut,
  Bell,
  Mail,
  MessageSquare,
  Target,
  Filter,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  DollarSign,
  BarChart3,
  Factory,
  Truck,
  ArrowUpDown,
  TrendingUp,
  Upload,
  AlertTriangle,
  Siren,
  Users,
  Boxes,
  LogOut,
  Bell,
  Mail,
  MessageSquare,
  Target,
  Filter,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  ListChecks,
};

export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = ICONS[name] ?? Boxes;
  return <Cmp className={className} />;
}
