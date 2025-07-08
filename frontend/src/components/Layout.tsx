import {Header} from './Header';
import {Footer} from './Footer';

export default function Layout({ children }: { children: any }) {
  return (
    <div>
      <Header />
      <main>
        {children} {/* contenido variable de cada página */}
      </main>
      <Footer />
    </div>
  );
}