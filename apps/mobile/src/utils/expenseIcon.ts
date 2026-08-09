import {
  Home,
  Zap,
  Droplets,
  Wifi,
  GraduationCap,
  Bus,
  CreditCard,
  ShoppingCart,
  Film,
  Scissors,
  HeartPulse,
  MoreHorizontal,
  Package,
  LucideIcon,
} from 'lucide-react-native';

// The fixed_expenses.category column is deliberately coarse (see
// apps/api DB schema: 'food' | 'transport' | 'leisure' | 'personal' |
// 'utilities' | 'healthcare' | 'education' | 'other') and isn't persisted
// with any per-item icon — every utility bill (rent, electricity, water,
// internet) shares the single 'utilities' category. Icon-by-category alone
// therefore renders every one of those with the same icon. This resolves
// by matching keywords in the expense's own name first, and only falls
// back to a broad per-category icon when nothing matches.
const NAME_KEYWORDS: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ['rent', 'mortgage', 'landlord'], icon: Home },
  { keywords: ['electric', 'power', 'kplc'], icon: Zap },
  { keywords: ['water'], icon: Droplets },
  { keywords: ['internet', 'wifi', 'fiber', 'broadband'], icon: Wifi },
  { keywords: ['school', 'fee', 'tuition'], icon: GraduationCap },
  { keywords: ['transport', 'bus', 'fare', 'matatu', 'fuel', 'petrol'], icon: Bus },
  { keywords: ['subscription', 'netflix', 'spotify', 'showmax', 'data'], icon: CreditCard },
  { keywords: ['grocery', 'groceries', 'food'], icon: ShoppingCart },
  { keywords: ['health', 'medical', 'hospital', 'insurance', 'nhif', 'sha'], icon: HeartPulse },
  { keywords: ['salon', 'barber', 'personal care'], icon: Scissors },
  { keywords: ['entertainment', 'movie', 'cinema'], icon: Film },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  food: ShoppingCart,
  transport: Bus,
  leisure: Film,
  personal: Scissors,
  utilities: Home,
  healthcare: HeartPulse,
  education: GraduationCap,
  other: MoreHorizontal,
};

export function getExpenseIcon(name: string, category?: string): LucideIcon {
  const lower = (name || '').toLowerCase();
  for (const { keywords, icon } of NAME_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return icon;
  }
  return (category && CATEGORY_ICONS[category]) || Package;
}