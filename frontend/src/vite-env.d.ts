/// <reference types="vite/client" />

// El logo del header está guardado como .PNG (mayúsculas) y vite/client
// solo declara la variante en minúsculas.
declare module "*.PNG" {
  const src: string;
  export default src;
}
