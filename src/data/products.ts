// Centralized Product Data for AFRO IN Store
// This file provides product data and helper functions for dynamic product pages

// Import product images
import camiseta1 from "@/assets/img/store/camiseta-1.webp";
import turbante from "@/assets/img/store/turbante.webp";
import collar from "@/assets/img/store/collar.webp";
import camiseta3 from "@/assets/img/store/camiseta-3.webp";
import gorra from "@/assets/img/store/gorra.webp";
import pulsera from "@/assets/img/store/pulsera.webp";
import bolso from "@/assets/img/store/bolso.webp";
import visera from "@/assets/img/store/visera.webp";
import camiseta2 from "@/assets/img/store/camiseta-2.webp";
import camiseta4 from "@/assets/img/store/camiseta-4.webp";

import camiseta5 from "@/assets/img/store/camiseta-5.png";
import camiseta6 from "@/assets/img/store/camiseta-6.png";
import gorraCafe from "@/assets/img/store/gorra-cafe.jpeg";
import gorraNegra from "@/assets/img/store/gorra-negra.jpeg";
import vaso from "@/assets/img/store/vaso.jpeg";

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
    slug: "camiseta-palenque-negra",
    sku: "AFR-ROP-CPN-01",
    name: "Camiseta Palenque Negra",
    description:
      "Camiseta 100% algodón con diseño exclusivo de Palenque. Celebra la cultura afro-colombiana con estilo. Estampado de alta calidad que no se destiñe.",
    price: 45000,
    priceUSD: 12,
    images: [camiseta1],
    category: "ropa",
    badge: "Popular",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Negro"],
    inStock: true,
    featured: true,
  },
  {
    id: 2,
    slug: "turbante-palenquero",
    sku: "AFR-ACC-TUP-02",
    name: "Turbante Palenquero",
    description:
      "Turbante tradicional palenquero hecho a mano. Tela de alta calidad con colores vibrantes. Perfecto para cualquier ocasión.",
    price: 35000,
    priceUSD: 9,
    images: [turbante],
    category: "accesorios",
    badge: "Popular",
    inStock: true,
    featured: true,
  },
  {
    id: 3,
    slug: "collar-africano",
    sku: "AFR-JOY-COA-03",
    name: "Collar Africano",
    description:
      "Collar artesanal con cuentas tradicionales africanas. Cada pieza es única y hecha a mano por artesanos locales.",
    price: 55000,
    priceUSD: 14,
    images: [collar],
    category: "joyeria",
    badge: "Nuevo",
    inStock: true,
    featured: true,
  },
  {
    id: 4,
    slug: "camiseta-festival-afro",
    sku: "AFR-ROP-CFA-04",
    name: "Camiseta Festival Afro",
    description:
      "Edición especial del Festival AFRO IN. Diseño exclusivo que celebra la música y el baile afro-colombiano.",
    price: 45000,
    priceUSD: 12,
    images: [camiseta3],
    category: "ropa",
    badge: "Nuevo",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Blanco"],
    inStock: true,
    featured: true,
  },
  {
    id: 5,
    slug: "gorra-afroin",
    sku: "AFR-ACC-GOR-05",
    name: "Gorra AFRO IN",
    description:
      "Gorra bordada con el logo de AFRO IN. Ajustable para todos los tamaños. Material resistente y cómodo.",
    price: 35000,
    priceUSD: 9,
    images: [gorra],
    category: "accesorios",
    badge: null,
    inStock: true,
    featured: false,
  },
  {
    id: 6,
    slug: "pulseras-africanas-set",
    sku: "AFR-JOY-PUL-06",
    name: "Pulseras Africanas Set",
    description:
      "Set de pulseras artesanales con diseños africanos. Incluye 3 pulseras de diferentes estilos. Ajustables.",
    price: 40000,
    priceUSD: 10,
    images: [pulsera],
    category: "joyeria",
    badge: null,
    inStock: true,
    featured: false,
  },
  {
    id: 7,
    slug: "bolso-artesanal",
    sku: "AFR-ACC-BOL-07",
    name: "Bolso Artesanal",
    description:
      "Bolso tejido a mano por artesanas de Palenque. Diseño único con colores tradicionales. Espacioso y resistente.",
    price: 85000,
    priceUSD: 22,
    images: [bolso],
    category: "accesorios",
    badge: null,
    inStock: true,
    featured: false,
  },
  {
    id: 8,
    slug: "visera-afroin",
    sku: "AFR-ACC-VIS-08",
    name: "Visera AFRO IN",
    description:
      "Visera deportiva con el logo de AFRO IN. Perfecta para días soleados. Material transpirable.",
    price: 30000,
    priceUSD: 8,
    images: [visera],
    category: "accesorios",
    badge: null,
    inStock: true,
    featured: false,
  },
  {
    id: 9,
    slug: "camiseta-palenque-2010",
    sku: "AFR-ROP-CP2-09",
    name: "Camiseta Palenque 2010",
    description:
      "Edición conmemorativa del festival 2010. Diseño vintage con gráficos originales de la época.",
    price: 45000,
    priceUSD: 12,
    images: [camiseta2],
    category: "ropa",
    badge: null,
    sizes: ["M", "L", "XL"],
    colors: ["Negro"],
    inStock: true,
    featured: false,
  },
  {
    id: 10,
    slug: "camiseta-afroin-classic",
    sku: "AFR-ROP-CAC-10",
    name: "Camiseta AFRO IN Classic",
    description:
      "Camiseta clásica con el logo de AFRO IN. Algodón premium, corte moderno. Un básico esencial.",
    price: 45000,
    priceUSD: 12,
    images: [camiseta4],
    category: "ropa",
    badge: null,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Negro", "Blanco"],
    inStock: true,
    featured: false,
  },
  {
    id: 11,
    slug: "camiseta-palenque-blanca",
    sku: "AFR-ROP-CPB-11",
    name: "Camiseta Palenque Blanca",
    description:
      "Camiseta blanca con diseño tradicional de Palenque. Patrones africanos vibrantes con texto AFRO IN en rojo y dorado. Algodón 100% premium.",
    price: 48000,
    priceUSD: 13,
    images: [camiseta5],
    category: "ropa",
    badge: "Nuevo",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Blanco"],
    inStock: true,
    featured: true,
  },
  {
    id: 12,
    slug: "camiseta-afro-roots",
    sku: "AFR-ROP-CAR-12",
    name: "Camiseta Afro Roots",
    description:
      "Camiseta edición limitada 'Afro Roots Colombia'. Diseño con tambor africano y silueta de palenquera. Celebra tus raíces con orgullo.",
    price: 50000,
    priceUSD: 13,
    images: [camiseta6],
    category: "ropa",
    badge: "Nuevo",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Negro"],
    inStock: true,
    featured: true,
  },
  {
    id: 13,
    slug: "gorra-afroin-cafe",
    sku: "AFR-ACC-GRC-13",
    name: "Gorra AFRO IN Café",
    description:
      "Gorra bordada de alta calidad en color café. Diseño elegante con el logo de AFRO IN. Ajustable y cómoda para el uso diario.",
    price: 38000,
    priceUSD: 10,
    images: [gorraCafe],
    category: "accesorios",
    badge: "Nuevo",
    inStock: true,
    featured: true,
  },
  {
    id: 14,
    slug: "gorra-afroin-negra",
    sku: "AFR-ACC-GRN-14",
    name: "Gorra AFRO IN Negra",
    description:
      "Nuestra clásica gorra AFRO IN en color negro. Estilo versátil y duradero. Bordado frontal de alta definición.",
    price: 38000,
    priceUSD: 10,
    images: [gorraNegra],
    category: "accesorios",
    badge: "Nuevo",
    inStock: true,
    featured: true,
  },
  {
    id: 15,
    slug: "vaso-afroin",
    sku: "AFR-ACC-VAS-15",
    name: "Vaso AFRO IN",
    description:
      "Vaso coleccionable con diseño exclusivo de AFRO IN. Perfecto para tus bebidas favoritas y para mostrar tu apoyo a la cultura afro.",
    price: 25000,
    priceUSD: 7,
    images: [vaso],
    category: "accesorios",
    badge: "Nuevo",
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
  }).format(price);
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.featured);
}
