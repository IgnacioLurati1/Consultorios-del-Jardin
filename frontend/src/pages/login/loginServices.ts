import api from "../../axios";

export function LoginService(email: string, password: string): Promise<{ token: string }>{
    return api.post(
            "/people/login",
            {
              email: email,
              password: password,
            },
            {
              withCredentials: true, // sin esto, no se envía ni se recibe la cookie
            }
          )
          .then(response => response.data)
          .catch((error) => {
            const backendMsg = error.response?.data?.message || error.message;
            const problem: any = new Error(backendMsg);
            // El código viaja con el error: una cuenta cerrada por posible intrusión no
            // se cuenta igual que una contraseña equivocada, y la pantalla lo distingue.
            problem.code = error.response?.data?.code;
            throw problem;
          });
}