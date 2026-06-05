import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names while de-duplicating Tailwind classes, for clean component styling */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
