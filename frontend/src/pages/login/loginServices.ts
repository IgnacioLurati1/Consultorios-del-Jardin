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
            throw new Error(backendMsg);
          });
}