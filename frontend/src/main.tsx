import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
// El CSS base de los avisos va antes que el nuestro: index.css lo pisa con el
// look del panel. Se carga una sola vez acá, así ninguna pantalla queda sin estilo.
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App/>
    </AuthProvider>
  </StrictMode>,
)
