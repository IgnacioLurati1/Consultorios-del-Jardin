
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
import { OfficesAdmin } from './pages/adminCRUDS/adminOffices/OfficesAdmin.tsx';
import { RoomsAdmin } from './pages/adminCRUDS/adminRooms/RoomsAdmin.tsx';
import  { RecoverPassword }  from './pages/newPassword/RecoverPassword.tsx'
import { NewPassword } from './pages/newPassword/NewPassword.tsx';
import { PrivateRoutes } from './PrivateRoutes.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />, 
    children: [

      // Public Routes
      { index:true, element: <Home /> },
      { path: '/Register', element: <Register /> },
      { path: '/RegisterProf', element: <RegisterProf />},
      { path: '/Login', element: <Login /> },
      // Private Routes
      { path: '/AdminHome', element: <PrivateRoutes allowedType="admin"><AdminHome /></PrivateRoutes> },
      { path: '/AdminHome/ProvincesAdmin', element: <PrivateRoutes allowedType="admin"><ProvincesAdmin /></PrivateRoutes> },
      { path: '/AdminHome/CitiesAdmin', element: <PrivateRoutes allowedType="admin"><CitiesAdmin /></PrivateRoutes> },
      { path: '/AdminHome/OfficesAdmin', element: <PrivateRoutes allowedType="admin"><OfficesAdmin /></PrivateRoutes> },
      { path: '/AdminHome/RoomsAdmin', element: <PrivateRoutes allowedType="admin"><RoomsAdmin /></PrivateRoutes> },
      // Password Recovery Routes
      { path: '/forgot-password', element: <RecoverPassword /> },
      { path: '/NewPassword', element: <NewPassword /> },
      // 404 Routes
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
