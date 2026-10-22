import Image from "next/image";

export function BrandLogos({ variant = "header" }: { variant?: "header" | "loading" }) {
  const isLoading = variant === "loading";
  const size = isLoading ? 72 : 35;

  return (
    <span className={`inline-flex shrink-0 items-center gap-2 ${isLoading ? "brand-logos-loading" : ""}`}>
      <Image
        src="/CBN logo.png"
        alt={isLoading ? "" : "Central Bank of Nigeria logo"}
        width={size}
        height={size}
        loading="eager"
        className="brand-logo brand-logo-primary shrink-0 object-contain"
      />
      <span
        aria-hidden="true"
        className={`brand-logo-divider w-px shrink-0 bg-gray-900 ${isLoading ? "h-14" : "h-8"}`}
      />
      <Image
        src="/Bankers' Committee logo (1).png"
        alt={isLoading ? "" : "Bankers' Committee logo"}
        width={size}
        height={size}
        loading="eager"
        className="brand-logo brand-logo-secondary shrink-0 object-contain"
      />
    </span>
  );
}
