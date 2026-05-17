import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'sans-serif', direction: 'rtl', padding: 32, textAlign: 'center',
          background: '#faf8f4',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#1a1a2e', marginBottom: 8 }}>משהו השתבש</h2>
          <p style={{ color: '#8888aa', fontSize: 14, marginBottom: 24, maxWidth: 320 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#2ec4a0', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px 24px', fontSize: 15,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            נסה שוב
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
