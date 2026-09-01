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
import { ProfessionalHome } from "./pages/homePages/professionalHome/professionalHome.tsx";
import { ScheduleProfessional } from "./pages/scheduleProfessional/scheduleProfessional.tsx";
import { AuthWatcher } from "./context/AuthWatcher.tsx";
import { UsersAdmin } from "./pages/adminCRUDS/adminUsers/usersAdmin.tsx";
import { BookAppointment } from "./pages/appointments/booking/BookAppointment.tsx";
import { AppointmentsList } from "./pages/appointments/appointmentsList/appointmentList.tsx";
import { ControlPanel } from "./pages/adminControl/ControlPanel.tsx";
import { PatientsPage } from "./pages/patients/PatientsPage.tsx";

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
          { path: "Control", element: <ControlPanel/>},
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
              <ScheduleProfessional />
            </AuthWatcher>
          </PrivateRoutes>
        ),
      },
      {
        path: "/Patients",
        element: (
          <PrivateRoutes allowedTypes={["professional"]}>
            <AuthWatcher>
              <PatientsPage />
            </AuthWatcher>
          </PrivateRoutes>
        ),
      },
      {
        path: "/Appointment",
        element: (
          <PrivateRoutes allowedTypes={["professional","admin","client"]}>
            <AuthWatcher>
              <BookAppointment />
            </AuthWatcher>
          </PrivateRoutes>
        ),
      },
      {path: "/AppointmentsList",
       element: (
        <PrivateRoutes allowedTypes={["professional","client"]}>
          <AuthWatcher>
            <AppointmentsList/>
          </AuthWatcher>
        </PrivateRoutes>
      )},
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
