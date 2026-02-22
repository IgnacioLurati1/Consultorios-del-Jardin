import {Header} from '../header/Header';
import {Outlet} from 'react-router-dom';
import { ChatAssistant } from '../chatAssistant/ChatAssistant';

export function Layout() {
  return (
    <div>
      <Header />
      <Outlet />
      <ChatAssistant />
    </div>
  );
}