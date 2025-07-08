
import {Home} from './pages/Home'
import {UserRegister} from './pages/UserRegister'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import {Layout} from './components/Layout';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,  // ← acá va tu Header, Footer, etc.
    children: [
      { path: '/Home', element: <Home /> },
      { path: '/UserRegister', element: <UserRegister /> },
    ]
  }
]);

function App() {
  return (  
      <RouterProvider router={router} />
)
}

export default App;
