import './polyfills'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { instalarCapturadorGlobal } from './lib/globalErrorHandler'
import './index.css'

// Atrapa errores que NO pasan por un try/catch nuestro (promesas
// rechazadas sin .catch, errores async sueltos). Sin esto, en el celular
// esos errores solo quedan en la consola del navegador (invisible para
// quien lo está usando) y nunca nos enteramos de qué pasó realmente.
instalarCapturadorGlobal()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
)