import type { Metadata } from 'next';
import { CheckoutClient } from './CheckoutClient';
import { PRODUCT } from '@/lib/config';

export const metadata: Metadata = { title: 'Pagamento' };

export default function Checkout() {
  return <CheckoutClient price={PRODUCT.price} productName={PRODUCT.shortName} />;
}
