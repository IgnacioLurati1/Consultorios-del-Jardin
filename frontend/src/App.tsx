import { Home } from "./pages/homePages/mainHome/Home.tsx";
import {AdminHome} from "./pages/homePages/adminHome/AdminHome.tsx"
import { Register } from "./pages/register/Register";
import { RegisterProf } from "./pages/adminCRUDS/adminUsers/RegisterProf.tsx";
import { Login } from "./pages/login/Login.tsx";
import { EditProfile } from "./pages/editProfie/EditProfile.tsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/defaultLayout/Layout.tsx";
import { NotFoundPage } from "./pages/notFoundPage/NotFoundPage.tsx";
import { ProvincesAdmin } from "./pages/adminCRUDS/adminProvinces/ProvincesAdmin.tsx";
import { CitiesAdmin } from "./pages/adminCRUDS/adminCities/CitiesAdmin.tsx";
import { OfficesAdmin } from "./pages/adminCRUDS/adminOffices/OfficesAdmin.tsx";
import { RoomsAdmin } from "./pages/adminCRUDS/adminRooms/RoomsAdmin.tsx";
import { RecoverPassword } from "./pages/newPassword/RecoverPassword.tsx";
import { NewPassword } from "./pages/newPassword/NewPassword.tsx";
import { PrivateRoutes } from "./PrivateRoutes.tsx";
import { Outlet } from "react-router-dom";
import CrudNav from "./components/crudNav/CrudNav.tsx";
import { ProfessionalHome } from "./pages/homePages/professionalHome/professionalHome.tsx";
import { ScheduleProfessional } from "./pages/scheduleProfessional/scheduleProfessional.tsx";
import { AuthWatcher } from "./context/AuthWatcher.tsx";
import { UsersAdmin } from "./pages/adminCRUDS/adminUsers/usersAdmin.tsx";
import { AppointmentInput } from "./pages/appointments/appointmentInputs/appointmentInput.tsx";
import { AppointmentDetails } from "./pages/appointments/appointmentDetails/appointmentDetails.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
    <Layout />),
    children: [
      // Public Routes
      { index: true, element: <Home /> },
      { path: "/Register", element: <Register /> },
      { path: "/Login", element: <Login /> },
      { path: "/EditProfile", element: (<PrivateRoutes allowedTypes={["admin","professional","client"]}>
            <AuthWatcher>
              <Outlet />
              <EditProfile />
            </AuthWatcher>
          </PrivateRoutes>) },

      // Private Routes
      {
        path: "/AdminHome",
        element: (
          <PrivateRoutes allowedTypes={["admin"]}>
            <AuthWatcher>
              <Outlet />
              <CrudNav />
            </AuthWatcher>
          </PrivateRoutes>
        ),
        children: [
          { path: "", element: <AdminHome/>},
          { path: "ProvincesAdmin", element: <ProvincesAdmin /> },
          { path: "CitiesAdmin", element: <CitiesAdmin /> },
          { path: "OfficesAdmin", element: <OfficesAdmin /> },
          { path: "RoomsAdmin", element: <RoomsAdmin /> },
          { path: "UsersAdmin", element: <UsersAdmin/>},
          { path: "RegisterProfAdmin", element: <RegisterProf/>},
        ],
      },

      // Professional Routes
      {
        path: "/ProfessionalHome",
        element: (
          <PrivateRoutes allowedTypes={["professional","admin"]}>
            <AuthWatcher>
              <ProfessionalHome />
            </AuthWatcher>
          </PrivateRoutes>
        ), 
      },
      {
        path: "scheduleProfessional",
        element: (
          <PrivateRoutes allowedTypes={["admin", "professional"]}>
            <AuthWatcher>
              <Outlet />
                <ScheduleProfessional />
              <CrudNav />
            </AuthWatcher>
          </PrivateRoutes>
        ),
      },
      {
        path: "/Appointment",
        element: (
          <PrivateRoutes allowedTypes={["professional","admin","client"]}>
            <AuthWatcher>
              <AppointmentInput />
            </AuthWatcher>
          </PrivateRoutes>
        ),
      },
      {
       path: "/AppointmentDetails", 
       element: (
            <PrivateRoutes allowedTypes={["professional","admin","client"]}>
              <AuthWatcher>
                <AppointmentDetails />
              </AuthWatcher>
            </PrivateRoutes>
          )
      },
      // Password Recovery Routes
      { path: "/forgot-password", element: <RecoverPassword /> },
      { path: "/reset-password", element: <NewPassword /> },
      // 404 Routes
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
