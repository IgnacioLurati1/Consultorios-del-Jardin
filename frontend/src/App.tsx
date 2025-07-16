
import {Home} from './pages/Home'
import {Register} from './pages/Register'
import {RegisterProf} from './pages/RegisterProf.tsx'
import {Login} from './pages/Login'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import {Layout} from './components/Layout';
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { AdminHome } from './pages/AdminHome.tsx';
import { ProvincesAdmin } from './pages/ProvincesAdmin.tsx';
import  { RecoverPassword }  from './pages/RecoverPassword.tsx'
import { NewPassword } from './pages/NewPassword.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />, 
    children: [
      { index:true, element: <Home /> },
      { path: '/Register', element: <Register /> },
      { path: '/RegisterProf', element: <RegisterProf />},
      { path: '/Login', element: <Login /> },
      { path: '/AdminHome', element: <AdminHome /> },
      { path: '/AdminHome/ProvincesAdmin', element: <ProvincesAdmin /> },
      { path: '/forgot-password', element: <RecoverPassword /> },
      { path: '/NewPassword', element: <NewPassword /> },
      { path:'*', element: <NotFoundPage/>}

    ]
  }
]);

function App() {
  return (  
      <RouterProvider router={router} />
)
}

export default App;
