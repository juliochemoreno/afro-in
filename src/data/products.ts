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
  name: { es: string; en: string; fr: string };
  description: { es: string; en: string; fr: string };
  price: number;
  priceUSD: number;
  images: ImageMetadata[];
  category: { es: string; en: string; fr: string };
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
    name: {
      es: "Camiseta Palenque 2020",
      en: "Palenque 2020 T-Shirt",
      fr: "T-shirt Palenque 2020",
    },
    description: {
      es: "Camiseta edición especial Palenque 2020. Un diseño icónico que celebra la historia y la resistencia cultural.",
      en: "Special edition Palenque 2020 T-shirt. An iconic design celebrating history and cultural resistance.",
      fr: "T-shirt édition spéciale Palenque 2020. Un design emblématique célébrant l'histoire et la résistance culturelle.",
    },
    price: 119900,
    priceUSD: 30,
    images: [camiseta1],
    category: { es: "ropa", en: "clothing", fr: "vêtements" },
    badge: "Premium",
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    featured: true,
  },
  {
    id: 10,
    slug: "camiseta-afroin-classic",
    sku: "AFR-ROP-CAC-10",
    name: {
      es: "Camiseta Clásica AFRO IN",
      en: "AFRO IN Classic T-Shirt",
      fr: "T-shirt Classique AFRO IN",
    },
    description: {
      es: "Nuestra camiseta insignia. Diseño limpio y moderno con el logo AFRO IN. Calidad premium para uso diario.",
      en: "Our flagship t-shirt. Clean and modern design with the AFRO IN logo. Premium quality for everyday use.",
      fr: "Notre t-shirt emblématique. Design épuré et moderne avec le logo AFRO IN. Qualité premium pour un usage quotidien.",
    },
    price: 89900,
    priceUSD: 23,
    images: [camiseta4],
    category: { es: "ropa", en: "clothing", fr: "vêtements" },
    badge: "Bestseller",
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    featured: true,
  },
  {
    id: 9,
    slug: "camiseta-negra-basica",
    sku: "AFR-ROP-CNB-09",
    name: {
      es: "Camiseta Negra AFRO IN",
      en: "AFRO IN Black T-Shirt",
      fr: "T-shirt Noir AFRO IN",
    },
    description: {
      es: "Camiseta negra esencial. Cómoda, duradera y con el estilo inconfundible de AFRO IN.",
      en: "Essential black t-shirt. Comfortable, durable, and with the unmistakable AFRO IN style.",
      fr: "T-shirt noir essentiel. Confortable, durable et avec le style inimitable d'AFRO IN.",
    },
    price: 69900,
    priceUSD: 18,
    images: [camiseta2],
    category: { es: "ropa", en: "clothing", fr: "vêtements" },
    badge: null,
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    featured: false,
  },
  {
    id: 8,
    slug: "gorra-sencilla",
    sku: "AFR-ACC-GSE-08",
    name: {
      es: "Gorra Sencilla",
      en: "Simple Cap",
      fr: "Casquette Simple",
    },
    description: {
      es: "Visera deportiva ligera y cómoda. Perfecta para protegerte del sol con estilo.",
      en: "Lightweight and comfortable sports visor. Perfect for protecting yourself from the sun with style.",
      fr: "Visière de sport légère et confortable. Parfaite pour vous protéger du soleil avec style.",
    },
    price: 59900,
    priceUSD: 15,
    images: [visera],
    category: { es: "gorras", en: "caps", fr: "casquettes" },
    badge: null,
    inStock: true,
    featured: false,
  },
  {
    id: 13,
    slug: "gorra-cafe",
    sku: "AFR-ACC-GRC-13",
    name: {
      es: "Gorra Café",
      en: "Brown Cap",
      fr: "Casquette Marron",
    },
    description: {
      es: "Gorra de alta calidad en tono café. Bordado premium y ajuste perfecto.",
      en: "High-quality brown cap. Premium embroidery and perfect fit.",
      fr: "Casquette marron de haute qualité. Broderie premium et ajustement parfait.",
    },
    price: 99999,
    priceUSD: 25,
    images: [gorraCafe],
    category: { es: "gorras", en: "caps", fr: "casquettes" },
    badge: "Nuevo",
    inStock: true,
    featured: true,
  },
  {
    id: 14,
    slug: "gorra-negra",
    sku: "AFR-ACC-GRN-14",
    name: {
      es: "Gorra Negra",
      en: "Black Cap",
      fr: "Casquette Noire",
    },
    description: {
      es: "La gorra negra definitiva de AFRO IN. Elegante, versátil y con acabados de primera.",
      en: "The definitive AFRO IN black cap. Elegant, versatile, and with top-notch finishes.",
      fr: "La casquette noire définitive d'AFRO IN. Élégante, polyvalente et aux finitions soignées.",
    },
    price: 89999,
    priceUSD: 23,
    images: [gorraNegra],
    category: { es: "gorras", en: "caps", fr: "casquettes" },
    badge: "Popular",
    inStock: true,
    featured: true,
  },
  {
    id: 15,
    slug: "termo-afroin",
    sku: "AFR-ACC-TER-15",
    name: {
      es: "Termo AFRO IN 90",
      en: "AFRO IN 90 Thermos",
      fr: "Thermos AFRO IN 90",
    },
    description: {
      es: "Mantén tus bebidas a la temperatura perfecta con nuestro termo exclusivo AFRO IN.",
      en: "Keep your drinks at the perfect temperature with our exclusive AFRO IN thermos.",
      fr: "Gardez vos boissons à la température idéale avec notre thermos exclusif AFRO IN.",
    },
    price: 89999,
    priceUSD: 23,
    images: [vaso],
    category: { es: "accesorios", en: "accessories", fr: "accessoires" },
    badge: "Nuevo",
    inStock: true,
    featured: true,
  },
  {
    id: 16,
    slug: "mug-afroin",
    sku: "AFR-ACC-MUG-16",
    name: {
      es: "Mug AFRO IN",
      en: "AFRO IN Mug",
      fr: "Mug AFRO IN",
    },
    description: {
      es: "Disfruta de tu café con estilo. Mug de cerámica de alta calidad con diseño AFRO IN.",
      en: "Enjoy your coffee with style. High-quality ceramic mug with AFRO IN design.",
      fr: "Savourez votre café avec style. Mug en céramique de haute qualité au design AFRO IN.",
    },
    price: 55000,
    priceUSD: 14,
    images: [mug],
    category: { es: "accesorios", en: "accessories", fr: "accessoires" },
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

  // Prioritize same category (using 'es' as safe reference), then featured
  const sameCategory = products.filter(
    (p) => p.category.es === current.category.es && p.slug !== currentSlug
  );
  const featured = products.filter(
    (p) => p.featured && p.slug !== currentSlug && p.category.es !== current.category.es
  );

  return [...sameCategory, ...featured].slice(0, limit);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price).replace(/\s/g, '');
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.featured);
}

export interface LocalizedProduct extends Omit<Product, 'name' | 'description' | 'category'> {
  name: string;
  description: string;
  category: string;
}

export function getLocalizedProduct(product: Product, lang: string): LocalizedProduct {
  const safeLang = (lang === 'en' || lang === 'fr') ? lang : 'es';
  return {
    ...product,
    name: product.name[safeLang],
    description: product.description[safeLang],
    category: product.category[safeLang],
  };
}
