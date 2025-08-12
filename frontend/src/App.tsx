
import {Home} from './pages/mainHome/Home.tsx'
import {Register} from './pages/register/Register'
import {RegisterProf} from './pages/registerProfessional/RegisterProf.tsx'
import {Login} from './pages/login/Login.tsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import {Layout} from './components/defaultLayout/Layout.tsx';
import { NotFoundPage } from './pages/notFoundPage/NotFoundPage.tsx'
import { AdminHome } from './pages/adminHome/AdminHome.tsx';
import { ProvincesAdmin } from './pages/adminCRUDS/adminProvinces/ProvincesAdmin.tsx';
import { CitiesAdmin } from './pages/adminCRUDS/adminCities/CitiesAdmin.tsx';
import  { RecoverPassword }  from './pages/newPassword/RecoverPassword.tsx'
import { NewPassword } from './pages/newPassword/NewPassword.tsx';

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
      { path: '/AdminHome/CitiesAdmin', element: <CitiesAdmin/> },
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
