
import {Home} from './pages/Home'
import {Register} from './pages/Register'
import {RegisterProf} from './pages/RegisterProf.tsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import {Layout} from './components/Layout';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,  // ← acá va tu Header, Footer, etc.
    children: [
      { path: '/Home', element: <Home /> },
      { path: '/Register', element: <Register /> },
      { path: '/RegisterProf', element: <RegisterProf />}
    ]
  }
]);

function App() {
  return (  
      <RouterProvider router={router} />
)
}

export default App;
