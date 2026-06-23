interface Props {
  provider?: string;
  className?: string;
}

// Brand marks for the two payment providers we support. lucide has no brand
// icons, so PayPal is an inline SVG and Bold is its wordmark.
export function PaymentIcon({ provider, className }: Props) {
  if (provider === "paypal") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        aria-label="PayPal"
        className={className}
      >
        <path
          fill="#003087"
          d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"
        />
        <path
          fill="#0070e0"
          d="M21.222 6.917a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527-.336 2.163a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"
        />
      </svg>
    );
  }

  // Bold wordmark
  return (
    <span
      aria-label="Bold"
      className={className}
      style={{
        fontWeight: 800,
        fontSize: "0.95rem",
        letterSpacing: "-0.03em",
        backgroundImage:
          "linear-gradient(95deg, #2b4bf2 0%, #8b3df0 50%, #f0425a 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }}
    >
      bold
    </span>
  );
}
