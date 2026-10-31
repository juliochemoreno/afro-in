// Minimal inline flags (4:3, public-domain designs reduced to their shapes) for the
// 2027 pages; see Flag.astro. Keyed by ISO 3166-1 alpha-2 code.
export const FLAGS: Record<string, { viewBox: string; svg: string }> = {
  CO: {
    viewBox: "0 0 640 480",
    svg: '<rect width="640" height="480" fill="#FCD116"/><rect y="240" width="640" height="120" fill="#003893"/><rect y="360" width="640" height="120" fill="#CE1126"/>',
  },
  FR: {
    viewBox: "0 0 640 480",
    svg: '<rect width="640" height="480" fill="#fff"/><rect width="214" height="480" fill="#0055A4"/><rect x="426" width="214" height="480" fill="#EF4135"/>',
  },
  CU: {
    viewBox: "0 0 640 480",
    svg: '<rect width="640" height="480" fill="#002A8F"/><rect y="96" width="640" height="96" fill="#fff"/><rect y="288" width="640" height="96" fill="#fff"/><polygon points="0,0 415,240 0,480" fill="#CF142B"/><polygon points="138.0,148.0 158.7,211.6 225.5,211.6 171.4,250.9 192.1,314.4 138.0,275.1 83.9,314.4 104.6,250.9 50.5,211.6 117.3,211.6" fill="#fff"/>',
  },
  VE: {
    viewBox: "0 0 640 480",
    svg: '<rect width="640" height="480" fill="#CF142B"/><rect width="640" height="320" fill="#00247D"/><rect width="640" height="160" fill="#FFCC00"/><polygon points="185.0,311.0 189.3,324.1 203.1,324.1 191.9,332.2 196.2,345.4 185.0,337.3 173.8,345.4 178.1,332.2 166.9,324.1 180.7,324.1" fill="#fff"/><polygon points="198.4,277.2 202.6,290.3 216.4,290.3 205.3,298.4 209.5,311.5 198.4,303.4 187.2,311.5 191.5,298.4 180.3,290.3 194.1,290.3" fill="#fff"/><polygon points="235.8,250.0 240.1,263.1 253.9,263.1 242.7,271.3 247.0,284.4 235.8,276.3 224.7,284.4 228.9,271.3 217.8,263.1 231.6,263.1" fill="#fff"/><polygon points="290.0,235.0 294.2,248.1 308.0,248.1 296.9,256.2 301.1,269.3 290.0,261.2 278.8,269.3 283.1,256.2 271.9,248.1 285.7,248.1" fill="#fff"/><polygon points="350.0,235.0 354.3,248.1 368.1,248.1 356.9,256.2 361.2,269.3 350.0,261.2 338.9,269.3 343.1,256.2 332.0,248.1 345.8,248.1" fill="#fff"/><polygon points="404.2,250.0 408.4,263.1 422.2,263.1 411.1,271.3 415.3,284.4 404.2,276.3 393.0,284.4 397.3,271.3 386.1,263.1 399.9,263.1" fill="#fff"/><polygon points="441.6,277.2 445.9,290.3 459.7,290.3 448.5,298.4 452.8,311.5 441.6,303.4 430.5,311.5 434.7,298.4 423.6,290.3 437.4,290.3" fill="#fff"/><polygon points="455.0,311.0 459.3,324.1 473.1,324.1 461.9,332.2 466.2,345.4 455.0,337.3 443.8,345.4 448.1,332.2 436.9,324.1 450.7,324.1" fill="#fff"/>',
  },
  GW: {
    viewBox: "0 0 640 480",
    svg: '<rect width="640" height="480" fill="#009E49"/><rect x="213" width="427" height="240" fill="#FCD116"/><rect width="213" height="480" fill="#CE1126"/><polygon points="107.0,162.0 124.5,215.9 181.2,215.9 135.3,249.2 152.8,303.1 107.0,269.8 61.2,303.1 78.7,249.2 32.8,215.9 89.5,215.9" fill="#000"/>',
  },
  GB: {
    viewBox: "0 0 60 30",
    svg: '<path fill="#012169" d="M-10 0h80v30h-80z"/><path d="M0 0 60 30M60 0 0 30" stroke="#fff" stroke-width="6"/><path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" stroke-width="2.4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/>',
  },
  CY: {
    viewBox: "0 0 640 480",
    svg: '<rect width="640" height="480" fill="#fff"/><path fill="#D57800" d="M168 262l30-22 36 6 38-24 54-12 68-26 58 6 52-26 22 18-30 36-14 38-52 18-70-4-58 14-62-8z"/><path d="M222 338c40 30 110 30 150-6M418 338c-40 30-110 30-150-6" fill="none" stroke="#4E5B31" stroke-width="9" stroke-linecap="round"/>',
  },
};
