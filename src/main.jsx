import React from 'react'
import ReactDOM from 'react-dom/client'
import AnaSayfa from './pages/AnaSayfa'
import Ekle from './pages/Ekle'
import Gecmis from './pages/Gecmis'
import './index.css'

console.log('[Renderer] Starting app v2')

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', { style: { padding: '2rem', background: '#fee', color: '#c00' } },
        React.createElement('h1', null, 'Hata!'),
        React.createElement('pre', null, this.state.error?.toString()),
        React.createElement('button', { onClick: () => window.location.reload() }, 'Yenile')
      )
    }
    return this.props.children
  }
}

function App() {
  const [route, setRoute] = React.useState('/')

  console.log('[App] Rendering, route:', route)

  React.useEffect(() => {
    const handle = () => setRoute(window.location.pathname || '/')
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [])

  const NavLink = ({ to, children }) => {
    const isActive = route === to
    return React.createElement('span', {
      onClick: (e) => {
        e.preventDefault()
        window.history.pushState(null, '', to)
        setRoute(to)
      },
      style: { 
        color: isActive ? '#fff' : '#ddd', 
        textDecoration: 'none', 
        fontWeight: '600', 
        cursor: 'pointer' 
      }
    }, children)
  }

  return React.createElement('div', { style: { minHeight: '100vh', display: 'flex', flexDirection: 'column' } },
    React.createElement('nav', { style: { background: '#2563eb', padding: '1rem', display: 'flex', gap: '1.5rem' } },
      React.createElement(NavLink, { to: '/' }, 'Ana Sayfa'),
      React.createElement(NavLink, { to: '/ekle' }, 'Ekle'),
      React.createElement(NavLink, { to: '/gecmis' }, 'Geçmiş')
    ),
    React.createElement('div', { style: { flex: 1, padding: '1.5rem' } },
      route === '/' && React.createElement(AnaSayfa),
      route === '/ekle' && React.createElement(Ekle),
      route === '/gecmis' && React.createElement(Gecmis)
    )
  )
}

console.log('[Renderer] Creating root')
const root = ReactDOM.createRoot(document.getElementById('root'))
console.log('[Renderer] Rendering App')
root.render(React.createElement(ErrorBoundary, null, React.createElement(App)))
console.log('[Renderer] Done')