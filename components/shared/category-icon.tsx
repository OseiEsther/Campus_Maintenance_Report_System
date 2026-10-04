import {
  Zap,
  Droplets,
  Building2,
  Trash2,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '@/lib/types';

const categoryIcons: Record<Category, LucideIcon> = {
  electrical: Zap,
  plumbing: Droplets,
  structural: Building2,
  sanitation: Trash2,
  other: MoreHorizontal,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const Icon = categoryIcons[category];
  return <Icon className={className} />;
}
