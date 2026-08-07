/**
 * 蓝鹰寄拍唯一品牌标记：复用 Android 鹰羽勾形矢量轮廓
 * （frontend/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml）。
 * full：图形 + 中文名；mark：仅图形，带 aria-label="蓝鹰寄拍"。
 * 品牌标记是项目中唯一允许的自制矢量，功能图标一律使用 @ant-design/icons。
 */
export function AppLogo({ variant = "full", size = 24, className }: { variant?: "full" | "mark"; size?: number; className?: string }) {
  const mark = (
    <svg className="app-logo-mark" width={size} height={size} viewBox="0 0 108 108" role="img" aria-label="蓝鹰寄拍" focusable="false">
      <path fill="#B33B5A" d="M26,83V28h14c22,0 37,12 42,33c-8,-5 -16,-7 -25,-5c6,4 10,9 12,15c-15,-2 -27,3 -35,12H26Z" />
      <path fill="none" stroke="#26756F" strokeWidth="7" strokeLinecap="round" d="M42,78c2,-21 12,-35 31,-43" />
      <path fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" d="M38,74l10,10l28,-33" />
    </svg>
  );
  if (variant === "mark") {
    return mark;
  }
  return (
    <span className={className ? `app-logo ${className}` : "app-logo"}>
      {mark}
      <span className="app-logo-text">蓝鹰寄拍</span>
    </span>
  );
}
