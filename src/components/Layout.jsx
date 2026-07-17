import { c, font } from '../theme'

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { -webkit-text-size-adjust: 100%; }

  body {
    font-family: ${font.sans};
    background: ${c.cream};
    color: ${c.ink};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior: none;
  }

  button, input, textarea, select {
    font-family: inherit;
  }

  button {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }
`

export default function Layout({ children }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
      {children}
    </>
  )
}
