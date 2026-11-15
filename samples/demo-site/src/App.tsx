import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PayCodePage, PayPage } from '@/pages/PayPage';
import { WayPage } from '@/pages/WayPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="pay/code" element={<PayCodePage />} />
        <Route path="pay/:id" element={<PayPage />} />
        <Route path=":slug" element={<WayPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
