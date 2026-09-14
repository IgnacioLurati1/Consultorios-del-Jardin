import { useEffect } from "react";
import seo from "../seo.json";

/**
 * Título, descripción y dirección canónica de las páginas públicas.
 *
 * Al publicar, cada una ya sale con lo suyo escrito en el HTML (scripts/seo-pages.mjs).
 * Esto es para cuando se llega navegando adentro de la aplicación: sin esto, la pestaña y
 * lo que lee un buscador al recorrer los links seguirían diciendo lo de la página anterior.
 *
 * Los textos viven en src/seo.json, que es el mismo archivo que lee el build.
 */
export type PublicPage = keyof typeof seo.pages;

function set(selector: string, attribute: string, value: string) {
  document.head.querySelector(selector)?.setAttribute(attribute, value);
}

function apply(path: PublicPage) {
  const meta = seo.pages[path];
  const url = path === "/" ? `${seo.site}/` : `${seo.site}${path}`;

  document.title = meta.title;
  set('meta[name="description"]', "content", meta.description);
  set('link[rel="canonical"]', "href", url);
  set('meta[property="og:title"]', "content", meta.title);
  set('meta[property="og:description"]', "content", meta.description);
  set('meta[property="og:url"]', "content", url);
  set('meta[name="twitter:title"]', "content", meta.title);
  set('meta[name="twitter:description"]', "content", meta.description);
}

/**
 * Pone los datos de una página pública mientras está en pantalla. Al salir vuelven los de
 * la portada, que son los del sitio en general: las pantallas privadas no tienen propios.
 */
export function usePageMeta(path: PublicPage) {
  useEffect(() => {
    apply(path);
    return () => apply("/");
  }, [path]);
}
