/** LAYER 2 — RECIPE. One filled action per surface. */
import type { ButtonHTMLAttributes } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return <button data-sid="Button.button.st-button" className={`st-button st-button--${variant} ${className}`} {...rest} />
}
