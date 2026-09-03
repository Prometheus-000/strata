/** LAYER 2 — RECIPE. One filled action per surface. */
import type { ButtonHTMLAttributes } from 'react'
import { defineControls } from '../../../src/controls/define'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return <button data-region="Button" data-sid="Button.button.st-button" className={`st-button st-button--${variant} ${className}`} {...rest} />
}

/** A button's variant is a pick; its padding is not a handle — one filled action per surface, sized by the system. */
export const controls = defineControls(Button, {
  variant: { options: ['primary', 'secondary', 'ghost'] },
  padding: false,
})
