// Centralized Product Data for AFRO IN Store
// This file provides product data and helper functions for dynamic product pages

// Import product images
import camiseta1 from "@/assets/img/store/camiseta-1.webp";
// import turbante from "@/assets/img/store/turbante.webp"; // Eliminado
// import collar from "@/assets/img/store/collar.webp"; // Eliminado
// import camiseta3 from "@/assets/img/store/camiseta-3.webp"; // Eliminado
// import gorra from "@/assets/img/store/gorra.webp"; // Eliminado
// import pulsera from "@/assets/img/store/pulsera.webp"; // Eliminado
// import bolso from "@/assets/img/store/bolso.webp"; // Eliminado
import visera from "@/assets/img/store/visera.webp";
import camiseta2 from "@/assets/img/store/camiseta-2.webp";
import camiseta4 from "@/assets/img/store/camiseta-4.webp";

// import camiseta5 from "@/assets/img/store/camiseta-5.png"; // Eliminado
// import camiseta6 from "@/assets/img/store/camiseta-6.png"; // Eliminado
import gorraCafe from "@/assets/img/store/gorra-cafe.jpeg";
import gorraNegra from "@/assets/img/store/gorra-negra.jpeg";
import vaso from "@/assets/img/store/vaso.jpeg";
import mug from "@/assets/img/store/mug.jpeg";

import type { ImageMetadata } from "astro";

export interface Product {
  id: number;
  slug: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  priceUSD: number;
  images: ImageMetadata[];
  category: string;
  badge: string | null;
  sizes?: string[];
  colors?: string[];
  inStock: boolean;
  featured: boolean;
}

export const products: Product[] = [
  {
    id: 1,
    slug: "camiseta-palenque-2020",
    sku: "AFR-ROP-CP20-01",
    name: "Camiseta Palenque 2020",
    description:
      "Camiseta edición especial Palenque 2020. Un diseño icónico que celebra la historia y la resistencia cultural.",
    price: 119900,
    priceUSD: 30,
    images: [camiseta1],
    category: "ropa",
    badge: "Premium",
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    featured: true,
  },
  {
    id: 10,
    slug: "camiseta-afroin-classic",
    sku: "AFR-ROP-CAC-10",
    name: "Camiseta Clásica AFRO IN",
    description:
      "Nuestra camiseta insignia. Diseño limpio y moderno con el logo AFRO IN. Calidad premium para uso diario.",
    price: 89900,
    priceUSD: 23,
    images: [camiseta4],
    category: "ropa",
    badge: "Bestseller",
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    featured: true,
  },
  {
    id: 9,
    slug: "camiseta-negra-basica",
    sku: "AFR-ROP-CNB-09",
    name: "Camiseta Negra AFRO IN",
    description:
      "Camiseta negra esencial. Cómoda, duradera y con el estilo inconfundible de AFRO IN.",
    price: 69900,
    priceUSD: 18,
    images: [camiseta2],
    category: "ropa",
    badge: null,
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    featured: false,
  },
  {
    id: 8,
    slug: "gorra-sencilla",
    sku: "AFR-ACC-GSE-08",
    name: "Gorra Sencilla",
    description:
      "Visera deportiva ligera y cómoda. Perfecta para protegerte del sol con estilo.",
    price: 59900,
    priceUSD: 15,
    images: [visera],
    category: "gorras",
    badge: null,
    inStock: true,
    featured: false,
  },
  {
    id: 13,
    slug: "gorra-cafe",
    sku: "AFR-ACC-GRC-13",
    name: "Gorra Café",
    description:
      "Gorra de alta calidad en tono café. Bordado premium y ajuste perfecto.",
    price: 99999,
    priceUSD: 25,
    images: [gorraCafe],
    category: "gorras",
    badge: "Nuevo",
    inStock: true,
    featured: true,
  },
  {
    id: 14,
    slug: "gorra-negra",
    sku: "AFR-ACC-GRN-14",
    name: "Gorra Negra",
    description:
      "La gorra negra definitiva de AFRO IN. Elegante, versátil y con acabados de primera.",
    price: 89999,
    priceUSD: 23,
    images: [gorraNegra],
    category: "gorras",
    badge: "Popular",
    inStock: true,
    featured: true,
  },
  {
    id: 15,
    slug: "termo-afroin",
    sku: "AFR-ACC-TER-15",
    name: "Termo AFRO IN 90",
    description:
      "Mantén tus bebidas a la temperatura perfecta con nuestro termo exclusivo AFRO IN.",
    price: 89999,
    priceUSD: 23,
    images: [vaso],
    category: "accesorios",
    badge: "Nuevo",
    inStock: true,
    featured: true,
  },
  {
    id: 16,
    slug: "mug-afroin",
    sku: "AFR-ACC-MUG-16",
    name: "Mug AFRO IN",
    description:
      "Disfruta de tu café con estilo. Mug de cerámica de alta calidad con diseño AFRO IN.",
    price: 55000,
    priceUSD: 14,
    images: [mug],
    category: "accesorios",
    badge: null,
    inStock: true,
    featured: true,
  },
];

// Helper Functions

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(
  currentSlug: string,
  limit: number = 4
): Product[] {
  const current = getProductBySlug(currentSlug);
  if (!current) return products.slice(0, limit);

  // Prioritize same category, then featured
  const sameCategory = products.filter(
    (p) => p.category === current.category && p.slug !== currentSlug
  );
  const featured = products.filter(
    (p) => p.featured && p.slug !== currentSlug && p.category !== current.category
  );

  return [...sameCategory, ...featured].slice(0, limit);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price).replace(/\s/g, ''); // Eliminar espacios raros si los hay
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.featured);
}
