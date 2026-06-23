// Shared types for the product CMS (grid + form page).

export interface ProductImage {
  id?: number;
  r2_key: string;
  content_type?: string;
  url: string;
}

export interface ProductRow {
  id: number;
  slug: string;
  sku: string;
  name_es: string;
  name_en: string;
  name_fr: string;
  description_es: string;
  description_en: string;
  description_fr: string;
  category_es: string;
  category_en: string;
  category_fr: string;
  price: number;
  price_usd: number | null;
  badge: string | null;
  sizes: string | null;
  colors: string | null;
  in_stock: number;
  featured: number;
  visible: number;
  sort_order: number;
  category_id?: number | null;
  images: ProductImage[];
}

export interface FormState {
  id?: number;
  slug: string;
  sku: string;
  name_es: string;
  name_en: string;
  name_fr: string;
  description_es: string;
  description_en: string;
  description_fr: string;
  category_es: string;
  category_en: string;
  category_fr: string;
  price: string;
  price_usd: string;
  badge: string;
  sizes: string;
  colors: string;
  in_stock: boolean;
  featured: boolean;
  visible: boolean;
  sort_order: string;
  images: ProductImage[];
}

export const EMPTY_PRODUCT: FormState = {
  slug: "",
  sku: "",
  name_es: "",
  name_en: "",
  name_fr: "",
  description_es: "",
  description_en: "",
  description_fr: "",
  category_es: "",
  category_en: "",
  category_fr: "",
  price: "",
  price_usd: "",
  badge: "",
  sizes: "",
  colors: "",
  in_stock: true,
  featured: false,
  visible: true,
  sort_order: "0",
  images: [],
};

export function productToForm(p: ProductRow): FormState {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name_es: p.name_es,
    name_en: p.name_en,
    name_fr: p.name_fr,
    description_es: p.description_es,
    description_en: p.description_en,
    description_fr: p.description_fr,
    category_es: p.category_es,
    category_en: p.category_en,
    category_fr: p.category_fr,
    price: String(p.price),
    price_usd: p.price_usd != null ? String(p.price_usd) : "",
    badge: p.badge || "",
    sizes: p.sizes || "",
    colors: p.colors || "",
    in_stock: !!p.in_stock,
    featured: !!p.featured,
    visible: !!p.visible,
    sort_order: String(p.sort_order ?? 0),
    images: (p.images || []).map((im) => ({
      id: im.id,
      r2_key: im.r2_key,
      content_type: im.content_type,
      url: im.url,
    })),
  };
}
