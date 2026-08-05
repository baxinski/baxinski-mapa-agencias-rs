type BrandLogoProps = {
  className?: string;
  framed?: boolean;
};

/** Shared visual identity used by the public header and authenticated workspaces. */
export default function BrandLogo({ className = "", framed = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo-shell${framed ? " brand-logo-shell-framed" : ""}${className ? ` ${className}` : ""}`}>
      {/* The supplied brand artwork is a static transparent PNG; keep its original colors and proportions. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="brand-logo-image"
        src="/branding/mapa-agencias-logo.png"
        alt="André Baxinski — Mapa de Agências"
        width={977}
        height={408}
        loading="eager"
        decoding="async"
      />
    </span>
  );
}
