import { flipAppearance, generateTheme } from '../theme/generateTheme'
import { themeTokens, type Ledger } from '../theme/ledger'
import LEDGER from '../theme/ledger.json'
import { useTheme } from '../theme/ThemeContext'

/* Appearance, on a mark rather than a switch. The dot after the wordmark is
   the door and the state: faint ink when the theme is monochrome, the accent
   when there is one. One click flips the ground; the Theme Lab holds the rest.
   It lives in its own file because two pages carry the wordmark, and the rule
   is that the dot is imported, never redrawn. */
export function AppearanceDot() {
  const { seeds, setSeeds } = useTheme()
  const dark = seeds.appearance === 'dark'
  const dot = seeds.chroma > 0
    ? themeTokens(generateTheme(seeds), LEDGER as Ledger, 'value')['--accent']
    : undefined
  return (
    <button
      className="appearance-dot"
      type="button"
      title={dark ? 'Appearance: dark — switch to light' : 'Appearance: light — switch to dark'}
      aria-label={dark ? 'Switch to light appearance' : 'Switch to dark appearance'}
      aria-pressed={!dark}
      style={dot ? ({ ['--dot' as string]: dot } as React.CSSProperties) : undefined}
      onClick={() => setSeeds((prev) => flipAppearance(prev))}
    >
      <span />
    </button>
  )
}
