export const PRODUCT_CATEGORIES = [
  { value: "服饰穿搭", color: "magenta" },
  { value: "美妆个护", color: "pink" },
  { value: "食品饮料", color: "orange" },
  { value: "家居生活", color: "gold" },
  { value: "母婴玩具", color: "cyan" },
  { value: "数码家电", color: "blue" },
  { value: "运动户外", color: "green" },
  { value: "珠宝配饰", color: "purple" },
  { value: "其他", color: "default" },
] as const;

export const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES.map(({ value }) => ({ value, label: value }));

export function productCategoryColor(category: string) {
  return PRODUCT_CATEGORIES.find((item) => item.value === category)?.color ?? "default";
}
