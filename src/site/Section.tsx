import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ---------- Reveal-on-scroll ---------- */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'reveal--in' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export function Section({
  kicker,
  title,
  sub,
  id,
  children,
}: {
  kicker: string
  title: string
  sub?: string
  id: string
  children: ReactNode
}) {
  return (
    <section className="section" id={id}>
      <div className="wrap">
        <Reveal>
          <div className="section__head">
            <span className="section__kicker">{kicker}</span>
            <h2 className="section__title">{title}</h2>
            {sub && <span className="section__sub">{sub}</span>}
          </div>
        </Reveal>
        {children}
      </div>
    </section>
  )
}
