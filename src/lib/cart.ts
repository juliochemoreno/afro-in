// Cart Store - Vanilla JavaScript cart management
// Uses localStorage for persistence and custom events for reactivity

export interface CartItem {
  id: string;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
  color?: string;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

const CART_KEY = 'afroin_cart';
const CART_EVENT = 'cart-updated';
const CART_OPEN_EVENT = 'cart-open';

// Get cart from localStorage
export function getCart(): Cart {
  if (typeof window === 'undefined') {
    return { items: [], totalItems: 0, totalPrice: 0 };
  }

  try {
    const stored = localStorage.getItem(CART_KEY);
    if (stored) {
      const items: CartItem[] = JSON.parse(stored);
      return calculateCartTotals(items);
    }
  } catch (e) {
    console.error('Error reading cart:', e);
  }

  return { items: [], totalItems: 0, totalPrice: 0 };
}

// Calculate totals from items
function calculateCartTotals(items: CartItem[]): Cart {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return { items, totalItems, totalPrice };
}

// Save cart to localStorage
function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_EVENT, {
    detail: calculateCartTotals(items)
  }));
}

// Add item to cart
export function addToCart(item: Omit<CartItem, 'quantity'> & { quantity?: number }): void {
  const cart = getCart();
  const existingIndex = cart.items.findIndex(i => i.id === item.id);

  if (existingIndex >= 0) {
    cart.items[existingIndex].quantity += (item.quantity || 1);
    // Refresh metadata in case it changed or was missing
    cart.items[existingIndex].name = item.name;
    cart.items[existingIndex].price = item.price;
    if (item.image) cart.items[existingIndex].image = item.image;
    if (item.sku) cart.items[existingIndex].sku = item.sku;
  } else {
    cart.items.push({ ...item, quantity: item.quantity || 1 });
  }

  saveCart(cart.items);
}

// Remove item from cart
export function removeFromCart(id: string): void {
  const cart = getCart();
  const items = cart.items.filter(item => item.id !== id);
  saveCart(items);
}

// Update item quantity
export function updateQuantity(id: string, quantity: number): void {
  const cart = getCart();
  const item = cart.items.find(i => i.id === id);

  if (item) {
    if (quantity <= 0) {
      removeFromCart(id);
    } else {
      item.quantity = quantity;
      saveCart(cart.items);
    }
  }
}

// Increment item quantity
export function incrementItem(id: string): void {
  const cart = getCart();
  const item = cart.items.find(i => i.id === id);
  if (item) {
    item.quantity += 1;
    saveCart(cart.items);
  }
}

// Decrement item quantity
export function decrementItem(id: string): void {
  const cart = getCart();
  const item = cart.items.find(i => i.id === id);
  if (item) {
    if (item.quantity <= 1) {
      removeFromCart(id);
    } else {
      item.quantity -= 1;
      saveCart(cart.items);
    }
  }
}

// Clear cart
export function clearCart(): void {
  saveCart([]);
}

// Format price for display
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(price);
}

// Subscribe to cart changes
export function onCartChange(callback: (cart: Cart) => void): () => void {
  if (typeof window === 'undefined') return () => { };

  const handler = (e: Event) => {
    callback((e as CustomEvent<Cart>).detail);
  };

  window.addEventListener(CART_EVENT, handler);
  return () => window.removeEventListener(CART_EVENT, handler);
}

// Open cart drawer
export function openCart(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT));
}

// Subscribe to cart open events
export function onCartOpen(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => { };
  window.addEventListener(CART_OPEN_EVENT, callback);
  return () => window.removeEventListener(CART_OPEN_EVENT, callback);
}

// Generate WhatsApp checkout URL
export function getWhatsAppCheckoutUrl(customerName?: string): string {
  const cart = getCart();
  const WHATSAPP_NUMBER = '41782231433';

  if (cart.items.length === 0) return '';

  let message = '🛒 *NUEVO PEDIDO AFRO IN*\n';
  if (customerName) message += `👤 *Cliente:* ${customerName}\n`;
  message += '\n';

  cart.items.forEach(item => {
    const sizeText = item.size ? ` (${item.size})` : '';
    const colorText = item.color ? ` - ${item.color}` : '';
    const skuText = item.sku ? ` [SKU: ${item.sku}]` : '';
    message += `${item.quantity}x ${item.name}${sizeText}${colorText}${skuText} - ${formatPrice(item.price * item.quantity)}\n`;
  });

  message += `\n💰 *Total: ${formatPrice(cart.totalPrice)}*\n\n`;
  message += 'Por favor confirmar disponibilidad y coordinar envío. 🙏\n\n';
  message += '--- \n';
  message += '🛒 Realizado desde https://afroin.org';

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Show toast notification
export function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  if (typeof window === 'undefined') return;

  // Remove existing toast
  const existing = document.getElementById('cart-toast');
  if (existing) existing.remove();

  // Create toast element
  const toast = document.createElement('div');
  toast.id = 'cart-toast';
  toast.className = `cart-toast cart-toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
    <span class="toast-message">${message}</span>
  `;

  document.body.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
