
import {Home} from './pages/Home'
import {Register} from './pages/Register'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import {Layout} from './components/Layout';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,  // ← acá va tu Header, Footer, etc.
    children: [
      { path: '/Home', element: <Home /> },
      { path: '/Register', element: <Register /> },
    ]
  }
]);

function App() {
  return (  
      <RouterProvider router={router} />
)
}

export default App;
